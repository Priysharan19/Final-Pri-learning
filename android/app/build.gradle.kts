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

val syncPriWeb by tasks.registering(Sync::class) {
    description = "Copies the shared Pri web build into the Android assets (assets/web)."
    from(webDist)
    into(generatedWeb.map { it.dir("web") })
    exclude("**/.DS_Store")
    doFirst {
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

android {
    namespace = "com.prilearning.app"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.prilearning.app"
        minSdk = 26
        targetSdk = 36
        versionCode = (project.findProperty("pri.versionCode") as String?)?.toInt() ?: 1
        versionName = "4.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        // The only production cloud origin source (HTTPS); empty fails closed.
        buildConfigField("String", "PRI_CLOUD_ORIGIN", "\"${project.findProperty("pri.cloudOrigin") ?: ""}\"")
    }

    buildFeatures { buildConfig = true }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    sourceSets["main"].assets.srcDir(generatedWeb)

    buildTypes {
        release {
            isMinifyEnabled = false
            // Signing comes from CI secrets / Play App Signing, never the repo.
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

tasks.named("preBuild") { dependsOn(syncPriWeb) }

dependencies {
    implementation(libs.androidx.webkit)
    implementation(libs.androidx.activity)
    implementation(libs.androidx.core.ktx)
    testImplementation(libs.junit)
    testImplementation(libs.json)
    androidTestImplementation(libs.androidx.test.runner)
    androidTestImplementation(libs.androidx.test.core)
    androidTestImplementation(libs.androidx.test.ext.junit)
}
