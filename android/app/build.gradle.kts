import java.util.Properties
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
}

// The shared web product, built by `npm run build` into client/dist. It is
// copied (never committed) into generated assets at build time; the build
// fails closed if it is missing or carries no valid release identity.
val webDist = rootProject.layout.projectDirectory.dir("../client/dist")
val generatedWeb = layout.buildDirectory.dir("generated/priWeb")

// A task with no inputs is never skipped as NO-SOURCE (a Sync whose source
// directory is missing would be, silently building an app with no web assets).
val verifyPriWeb by tasks.registering {
    description = "Fails the build unless client/dist holds a web build with a valid release identity."
    doLast {
        val release = webDist.file("release.json").asFile
        require(webDist.asFile.resolve("index.html").isFile) {
            "client/dist is missing — run `npm run build` at the repository root first"
        }
        require(release.isFile) { "client/dist/release.json is missing — the web build has no release identity" }
        val text = release.readText()
        require(Regex("\"schemaVersion\"\\s*:\\s*1").containsMatchIn(text) &&
            Regex("\"releaseSha\"\\s*:\\s*\"[0-9a-f]{40}\"").containsMatchIn(text)) {
            "client/dist/release.json is not a valid release identity"
        }
    }
}

val syncPriWeb by tasks.registering(Sync::class) {
    description = "Copies the shared Pri web build into the Android assets (assets/web)."
    dependsOn(verifyPriWeb)
    from(webDist)
    into(generatedWeb.map { it.dir("web") })
    exclude("**/.DS_Store")
}

// The production cloud origin: empty (cloud off, fails closed) or one HTTPS
// origin with no path. Validated here so nothing unescaped reaches BuildConfig.
val cloudOrigin = (project.findProperty("pri.cloudOrigin") as String?)?.trim().orEmpty()
require(cloudOrigin.isEmpty() || Regex("^https://[a-z0-9]([a-z0-9-]*[a-z0-9])?(\\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+(:[0-9]{1,5})?$").matches(cloudOrigin)) {
    "pri.cloudOrigin must be empty or an https origin with no path (got '$cloudOrigin')"
}
val releaseRequested = gradle.startParameter.taskNames.any { t -> val n = t.substringAfterLast(":"); n.contains("Release", ignoreCase = true) || n.startsWith("bundle") || n == "assemble" || n == "build" }
val versionCodeProperty = (project.findProperty("pri.versionCode") as String?)?.toIntOrNull()
require(!releaseRequested || (versionCodeProperty != null && versionCodeProperty > 0)) {
    "release builds need -Ppri.versionCode=<positive integer> (Play rejects reused version codes)"
}

// Upload-key signing (Play App Signing holds the app signing key; we sign the
// AAB with the UPLOAD key only). The key and its passwords live outside the
// repository, by default in ~/.pri-secrets/android/upload-signing.properties
// (android/scripts/create-upload-key.sh writes it); -Ppri.uploadSigning=<file>
// or PRI_UPLOAD_SIGNING overrides the path. A release bundle without it fails
// closed, unless -Ppri.unsignedRelease=true is passed (CI compile checks only;
// Play rejects an unsigned upload).
val uploadSigningFile = ((project.findProperty("pri.uploadSigning") as String?)
    ?: System.getenv("PRI_UPLOAD_SIGNING")
    ?: "${System.getProperty("user.home")}/.pri-secrets/android/upload-signing.properties").let(::file)
val uploadSigning = Properties().apply {
    if (uploadSigningFile.isFile) uploadSigningFile.inputStream().use { load(it) }
}
val unsignedRelease = (project.findProperty("pri.unsignedRelease") as String?) == "true"
val bundleRequested = gradle.startParameter.taskNames.any { t -> t.substringAfterLast(":").let { it.startsWith("bundle") && it.contains("Release", ignoreCase = true) } }
if (uploadSigning.isEmpty && !uploadSigningFile.isFile) {
    require(!bundleRequested || unsignedRelease) {
        "release bundles are signed with the upload key: $uploadSigningFile is missing — run android/scripts/create-upload-key.sh (or pass -Ppri.unsignedRelease=true for a compile-only check)"
    }
} else {
    for (key in listOf("storeFile", "storePassword", "keyAlias", "keyPassword")) {
        require(!uploadSigning.getProperty(key).isNullOrBlank()) { "$uploadSigningFile has no $key" }
    }
    require(file(uploadSigning.getProperty("storeFile")).isFile) { "upload keystore ${uploadSigning.getProperty("storeFile")} is missing" }
    require(!file(uploadSigning.getProperty("storeFile")).canonicalPath.startsWith(rootProject.projectDir.parentFile.canonicalPath + File.separator)) {
        "the upload keystore must live outside the repository"
    }
}

android {
    namespace = "com.prilearning.app"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.prilearning.app"
        minSdk = 26
        targetSdk = 36
        versionCode = versionCodeProperty ?: 1
        versionName = "4.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        // The only production cloud origin source (HTTPS); empty fails closed.
        buildConfigField("String", "PRI_CLOUD_ORIGIN", "\"$cloudOrigin\"")
        // App Links (account-action) are declared for the cloud host only. With no
        // cloud origin the filter names the reserved, never-resolving .invalid TLD.
        manifestPlaceholders["priCloudHost"] = cloudOrigin.removePrefix("https://").substringBefore(":").ifEmpty { "cloud.invalid" }
    }

    buildFeatures { buildConfig = true }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    sourceSets["main"].assets.srcDir(generatedWeb)

    signingConfigs {
        if (!uploadSigning.isEmpty) create("upload") {
            storeFile = file(uploadSigning.getProperty("storeFile"))
            storePassword = uploadSigning.getProperty("storePassword")
            keyAlias = uploadSigning.getProperty("keyAlias")
            keyPassword = uploadSigning.getProperty("keyPassword")
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            // Signed with the upload key from outside the repo (see above);
            // Play App Signing re-signs for distribution.
            signingConfig = signingConfigs.findByName("upload")
        }
    }

    testOptions { unitTests.isReturnDefaultValues = true }
    lint {
        abortOnError = true
        checkReleaseBuilds = true
    }
}

kotlin {
    compilerOptions { jvmTarget.set(JvmTarget.JVM_17) }
}

tasks.named("preBuild") { dependsOn(verifyPriWeb, syncPriWeb) }

dependencies {
    implementation(libs.androidx.webkit)
    implementation(libs.androidx.activity)
    implementation(libs.androidx.core.ktx)
    implementation(libs.play.billing)
    implementation(libs.play.auth.phone)
    implementation(libs.androidx.fragment)
    testImplementation(libs.junit)
    testImplementation(libs.json)
    androidTestImplementation(libs.androidx.test.runner)
    androidTestImplementation(libs.androidx.test.core)
    androidTestImplementation(libs.androidx.test.ext.junit)
}
