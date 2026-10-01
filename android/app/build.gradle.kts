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
    }

    buildFeatures { buildConfig = true }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    sourceSets["main"].assets.srcDir(generatedWeb)

    // Upload-key signing for release builds comes only from the CI environment
    // (Play App Signing holds the app signing key). Nothing secret is in the repo;
    // without these variables a release build is simply unsigned.
    val keystore = System.getenv("PRI_ANDROID_UPLOAD_KEYSTORE")
    signingConfigs {
        if (!keystore.isNullOrBlank()) {
            create("upload") {
                storeFile = file(keystore)
                storePassword = System.getenv("PRI_ANDROID_UPLOAD_STORE_PASSWORD")
                keyAlias = System.getenv("PRI_ANDROID_UPLOAD_KEY_ALIAS")
                keyPassword = System.getenv("PRI_ANDROID_UPLOAD_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            if (!keystore.isNullOrBlank()) signingConfig = signingConfigs.getByName("upload")
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
    implementation(libs.androidx.fragment)
    testImplementation(libs.junit)
    testImplementation(libs.json)
    androidTestImplementation(libs.androidx.test.runner)
    androidTestImplementation(libs.androidx.test.core)
    androidTestImplementation(libs.androidx.test.ext.junit)
}
