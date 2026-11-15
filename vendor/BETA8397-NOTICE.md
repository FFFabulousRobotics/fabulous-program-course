# Beta8397 integration provenance

Upstream: https://github.com/Beta8397/virtual_robot

Downloaded the official `master` ZIP on 2026-09-13. SHA-256 of `beta8397-master.zip`:
`5B0579736D05869C936578F1EDCBDF6F805405ACEFA4A8DA5050F72DB42A93C7`.
The extracted runtime sources and applicable notices are in `virtual_robot-master`.
Upstream copyright, Apache-2.0 license, Qualcomm source notices and dependency notices are retained in `virtual_robot-master/LEGAL` and source headers.

OpenJFX 21.0.8 Windows artifacts (base/graphics/controls/fxml/swing) were obtained from Maven Central `org.openjfx`. OpenJFX uses GPL v2 with Classpath Exception: https://openjdk.org/legal/gplv2+ce.html . Original artifact metadata/licenses are retained in the JARs where supplied.

Local changes to upstream `VirtualRobotController.java` are marked FabulousProgram:

- Resource lookup uses the original controller class so an adapter subclass can load the original FXML.
- A telemetry factory hook permits observation of updates while retaining Beta's `TelemetryImpl`.
- A loop hook permits exact 1/3/7 loop-count exercise tests.
- An exception hook exposes iterative OpMode errors to the web host.
- An INIT-cancellation flag allows graceful stop without interrupting the lifecycle thread's join.

Adapter sources in `../beta-src` load the original FXML/controller/virtual hardware and dyn4j physics. JavaFX renders offscreen; snapshots are sent to the web client. The adapter does not replace the physics world with a browser animation. The final STOP telemetry is flushed before upstream restores its hardware overview. Iterative grading waits for the configured number of loop calls to finish (up to 10 seconds), instead of sending STOP after a fixed observation interval.

Limitations: this is Beta8397's compatible SDK implementation, not the official Android Robot Controller. The selected robot is upstream MecanumBot; field is DECODE, not BIOBUZZ. No claim is made that arbitrary Pedro versions, Android APIs, cameras or native-device integrations work. Each program is first compiled against the locally mounted official FTC SDK, then compiled/executed against Beta. Unsupported Beta APIs are reported separately at the second compile stage.

Build: `node scripts/build-beta.mjs`. This uses `FP_JAVA_HOME`, `JAVA_HOME`, or a locally available JDK 21 and writes the machine-specific runtime paths under `beta-build/`. No global JDK configuration is changed.
