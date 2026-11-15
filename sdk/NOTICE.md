# Local FTC SDK artifacts

RobotCore, Hardware and FtcCommon version 11.0.0 are unmodified official artifacts copied from the existing Maven/Gradle cache on this machine. Their classes.jar entries are extracted as matching JAR files for local javac and JVM use. The runtime JARs, RobotCore sources JAR, and applicable upstream notices are retained here.

Upstream: https://github.com/FIRST-Tech-Challenge/FtcRobotController

Android API android.jar is copied from the existing FTC project's bundled OnBotJava assets. It provides Android API definitions for compilation; it is not a running Android device.

The Java runtime is configured with FP_JAVA_HOME, JAVA_HOME, or a host JDK 21 installation. JudgeHarness is project-owned code that supplies desktop lifecycle events and a telemetry receiver. Official FTC OpMode and LinearOpMode bytecode are not replaced with mock classes.
