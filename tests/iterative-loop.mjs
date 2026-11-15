import assert from 'node:assert/strict';
import {initJudge,judge} from '../src/judge.mjs';
import {lessons} from '../src/curriculum.mjs';

await initJudge();
const task=lessons.find(l=>l.id==='w1-04').codeTask;
const source=`import com.qualcomm.robotcore.eventloop.opmode.*;
@TeleOp(name="IterativeDemo") public class IterativeDemo extends OpMode {
    int calls=0;
    public void init(){telemetry.addData("Status","Ready");telemetry.update();}
    public void loop(){
        try{Thread.sleep(90);}catch(InterruptedException e){Thread.currentThread().interrupt();}
        calls++;
        telemetry.addData("Status","Running");telemetry.update();
    }
    public void stop(){System.out.println("LOOP_CALLS="+calls);telemetry.addData("Status","Stopped");telemetry.update();}
}`;
const result=await judge(source,task);
assert.equal(result.status,'AC',JSON.stringify(result));
for(const [i,count] of [1,3,7].entries())assert.match(result.cases[i].output,new RegExp('LOOP_CALLS='+count+'\\n'));
console.log('PASS: 1/3/7 actual loop calls complete even when seven calls exceed the old 450 ms window');

const seven={...task,tests:[task.tests[2]]};
const wrong=await judge(source.replace('"Running"','"Ready"'),seven);
assert.equal(wrong.status,'WA');
const missing=await judge(source.replace('telemetry.addData("Status","Running");telemetry.update();',''),seven);
assert.equal(missing.status,'WA');
const blocked=await judge(source.replace('calls++;','while(calls==0){} calls++;'),seven);
assert.equal(blocked.status,'TLE',JSON.stringify(blocked));
console.log('PASS: wrong/missing lifecycle updates remain WA and a blocked loop remains TLE');
