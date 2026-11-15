import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {join,resolve,delimiter} from 'node:path';
import {initBeta,createSimulation,simulationState,simulationCommand,closeSimulation,betaJudge} from '../src/beta.mjs';
const sdk=resolve('sdk');await initBeta((await readdir(sdk)).filter(x=>x.endsWith('.jar')&&!x.includes('sources')).map(x=>join(sdk,x)).join(delimiter));
const source='import com.qualcomm.robotcore.eventloop.opmode.*; @TeleOp(name="MyFirstOp") public class MyFirstOp extends LinearOpMode { public void runOpMode(){telemetry.addData("Status","Ready");telemetry.update();waitForStart();if(isStopRequested())return;while(opModeIsActive()){telemetry.addData("Status","Running");telemetry.update();}}}';
const sim=await createSimulation(source,'test-owner');console.log('Created',sim.id,sim.phase,sim.image.length);assert.ok(sim.image.startsWith('data:image/png'));
try{
 await assert.rejects(()=>simulationState(sim.id,'other-owner'));
 for(const command of ['INIT','START','STOP']){await simulationCommand(sim.id,'test-owner',{command});await new Promise(r=>setTimeout(r,1500));const state=await simulationState(sim.id,'test-owner');console.log(command,state.phase,state.telemetry,state.error);assert.equal(state.phase,command);}
}finally{await closeSimulation(sim.id,'test-owner');}
const empty=await createSimulation('import com.qualcomm.robotcore.eventloop.opmode.*;public class Empty extends LinearOpMode{public void runOpMode(){}}','empty-owner');
try{await simulationCommand(empty.id,'empty-owner',{command:'INIT'});await new Promise(r=>setTimeout(r,1800));const state=await simulationState(empty.id,'empty-owner');assert.equal(state.phase,'STOP');assert.equal(state.ended,false);assert.equal(state.error,'');assert.ok(!state.console.includes('Cannot obtain'));console.log('PASS: empty program exits cleanly without breaking snapshots');}finally{await closeSimulation(empty.id,'empty-owner');}
const result=await betaJudge(source,{kind:'linear',tests:[{name:'normal',scenario:'linear'},{name:'cancel',scenario:'cancel'}]},false);console.log(JSON.stringify(result));assert.equal(result.status,'AC');
const motorSource='import com.qualcomm.robotcore.eventloop.opmode.*;import com.qualcomm.robotcore.hardware.*;public class Drive extends LinearOpMode {public void runOpMode(){DcMotor fl=hardwareMap.get(DcMotor.class,"front_left_motor"),bl=hardwareMap.get(DcMotor.class,"back_left_motor"),fr=hardwareMap.get(DcMotor.class,"front_right_motor"),br=hardwareMap.get(DcMotor.class,"back_right_motor");waitForStart();while(opModeIsActive()){fl.setPower(-.5);bl.setPower(-.5);fr.setPower(.5);br.setPower(.5);}}}';
const drive=await createSimulation(motorSource,'driver');try{await simulationCommand(drive.id,'driver',{command:'INIT'});await new Promise(r=>setTimeout(r,600));await simulationCommand(drive.id,'driver',{command:'START'});await new Promise(r=>setTimeout(r,1400));const moved=await simulationState(drive.id,'driver');console.log('Physics',moved.x,moved.y,moved.motors);assert.ok(Math.hypot(moved.x-drive.x,moved.y-drive.y)>1);assert.ok(moved.motors.some(m=>m.encoder!==0));}finally{await closeSimulation(drive.id,'driver');}
for(const statement of ['java.nio.file.Files.readString(java.nio.file.Path.of("C:/Windows/win.ini"));','new java.net.Socket("127.0.0.1",5173);','new ProcessBuilder("cmd.exe").start();']){
 const unsafe='import com.qualcomm.robotcore.eventloop.opmode.*;public class Unsafe extends LinearOpMode{public void runOpMode(){try{'+statement+'}catch(Exception e){throw new RuntimeException(e);}}}';
 const result=await betaJudge(unsafe,{kind:'linear'},true);console.log('Sandbox',result.status,result.message);assert.equal(result.status,'RE');assert.ok(result.message.includes('AccessControlException'));
}
