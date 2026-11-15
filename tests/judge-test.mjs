import assert from 'node:assert/strict';
import {initJudge,judge} from '../src/judge.mjs';
import {lessons} from '../src/curriculum.mjs';
export const hello='public class Hello { public static void main(String[] args) {System.out.println("Hello, FTC 19726!");System.out.println("Ready for BIOBUZZ.");}}';
export const linear='import com.qualcomm.robotcore.eventloop.opmode.*; @TeleOp(name="MyFirstOp") public class MyFirstOp extends LinearOpMode { public void runOpMode() { telemetry.addData("Status","Ready"); telemetry.update(); waitForStart(); if(isStopRequested())return; while(opModeIsActive()){telemetry.addData("Status","Running");telemetry.update();}}}';
export const iterative='import com.qualcomm.robotcore.eventloop.opmode.*; @TeleOp(name="IterativeDemo") public class IterativeDemo extends OpMode { public void init(){telemetry.addData("Status","Ready");telemetry.update();} public void loop(){telemetry.addData("Status","Running");telemetry.update();} public void stop(){telemetry.addData("Status","Stopped");telemetry.update();}}';
await initJudge();
for(const runOnly of [true,false]) {
 const empty=await judge(lessons[1].codeTask.starter,lessons[1].codeTask,runOnly);
 assert.equal(empty.status,runOnly?'RUN':'WA');
 assert.equal(empty.output,'');
 assert.equal(empty.score,runOnly?undefined:0);assert.equal(empty.passed,runOnly?undefined:0);
 const correct=await judge(hello,lessons[1].codeTask,runOnly);
 assert.equal(correct.status,runOnly?'RUN':'AC');assert.equal(correct.score,runOnly?undefined:100);
 assert.equal(correct.output,'Hello, FTC 19726!\nReady for BIOBUZZ.\n');
}
const arbitrary=await judge('public class Hello {public static void main(String[] args){System.out.println("arbitrary output");System.err.print("debug");}}',{kind:'java'},true);
assert.equal(arbitrary.status,'RUN');assert.equal(arbitrary.output,'arbitrary output\n');assert.equal(arbitrary.stderr,'debug');assert.equal(arbitrary.cases,undefined);
for(const source of [linear.replace('@TeleOp(name="MyFirstOp")','').replaceAll('"Running"','"Custom"'),iterative.replace('@TeleOp(name="IterativeDemo")','').replaceAll('"Running"','"Custom"')]) {
 const run=await judge(source,{kind:'linear'},true);assert.equal(run.status,'RUN');assert.ok(run.output.includes('Custom'));assert.equal(run.score,undefined);
}
for(const [source,index] of [[hello,1],[linear,2],[iterative,3]]) {const result=await judge(source,lessons[index].codeTask); console.log(lessons[index].id,JSON.stringify(result));assert.equal(result.status,'AC');}
for(const [name,source,index,status] of [
 ['missing SDK method',linear.replace('waitForStart();','nonExistingSDKMethod();'),2,'CE'],
 ['missing wait',linear.replace('waitForStart();',''),2,'WA'],
 ['wrong loop phase',iterative.replace('"Running"','"Ready"'),3,'WA'],
 ['early return',linear.replace('while(opModeIsActive())','for(int i=0;i<3;i++)'),2,'WA']
]){const result=await judge(source,lessons[index].codeTask);console.log(name,result.status);assert.equal(result.status,status);}
for(const [name,source,expected] of [
 ['syntax','public class Hello { public static void main(String[] args) { broken } }','CE'],
 ['wrong','public class Hello { public static void main(String[] args) {System.out.println("wrong");}}','WA'],
 ['exception','public class Hello { public static void main(String[] args) {throw new IllegalStateException("test");}}','RE'],
 ['timeout','public class Hello { public static void main(String[] args) {while(true){}}}','TLE'],
 ['filesystem','public class Hello { public static void main(String[] args) throws Exception {System.out.println(java.nio.file.Files.readString(java.nio.file.Path.of("C:/Windows/win.ini")));}}','RE'],
 ['process','public class Hello { public static void main(String[] args) throws Exception {new ProcessBuilder("cmd.exe").start();}}','RE'],
 ['network','public class Hello { public static void main(String[] args) throws Exception {new java.net.Socket("127.0.0.1",5173);}}','RE']
]) {const result=await judge(source,lessons[1].codeTask);console.log(name,result.status,result.message);assert.equal(result.status,expected);}
console.log('Judge acceptance checks passed');
