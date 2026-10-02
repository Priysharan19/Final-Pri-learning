// Pri Learning · Android shell (CP-06). A thin Kotlin + WebView shell around the
// same shared React/Vite product (client/dist). No learning logic lives here.
pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}
rootProject.name = "PriLearning"
include(":app")
