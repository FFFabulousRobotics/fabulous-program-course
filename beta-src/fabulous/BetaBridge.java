package fabulous;

import com.qualcomm.robotcore.eventloop.opmode.*;
import com.qualcomm.robotcore.hardware.*;
import javafx.application.Platform;
import javafx.fxml.FXMLLoader;
import javafx.scene.Parent;
import javafx.scene.Scene;
import javafx.scene.control.*;
import javafx.embed.swing.SwingFXUtils;
import javax.imageio.ImageIO;
import java.io.*;
import java.lang.reflect.*;
import java.net.*;
import java.nio.file.*;
import java.security.*;
import java.util.*;
import java.util.concurrent.*;
import org.firstinspires.ftc.robotcore.external.Telemetry;
import org.firstinspires.ftc.robotcore.internal.opmode.TelemetryImpl;
import virtual_robot.controller.*;
import virtual_robot.robots.classes.MecanumBot;

/** Web adapter. Physics, virtual devices, OpMode lifecycle and telemetry remain Beta8397 code. */
public final class BetaBridge {
    private static WebController controller;
    private static Path work;
    private static Class<?> student;
    private static volatile String phase="READY", lastTelemetry="", verdict="", detail="";
    private static final List<String> events=Collections.synchronizedList(new ArrayList<>());
    private static final Properties rules=new Properties();
    private static String rule(String key,String fallback){return rules.getProperty(key,fallback);}
    private static int duration(String key,int fallback){return Integer.parseInt(rule(key,String.valueOf(fallback)));}
    private static long revision=0;
    private static volatile int loopLimit=0,loopCount=0;
    private static volatile String executionError="";
    private static String telemetryLog="";
    private static Object get(Object object,String name) throws Exception {
        Class<?> type=object.getClass();
        while(type!=null){try{Field f=type.getDeclaredField(name);f.setAccessible(true);return f.get(object);}catch(NoSuchFieldException e){type=type.getSuperclass();}}
        throw new NoSuchFieldException(name);
    }
    private static void set(Object object,String name,Object value) throws Exception {
        Class<?> type=object.getClass();
        while(type!=null){try{Field f=type.getDeclaredField(name);f.setAccessible(true);f.set(object,value);return;}catch(NoSuchFieldException e){type=type.getSuperclass();}}
        throw new NoSuchFieldException(name);
    }
    public static class WebController extends VirtualRobotController {
        @Override protected Telemetry createTelemetry(){return new ObservedTelemetry(this);}
        @Override public void updateTelemetryDisplay(String text){super.updateTelemetryDisplay(text);if(!text.equals(lastTelemetry)&&telemetryLog.length()<50000)telemetryLog+="["+phase+"] "+text;lastTelemetry=text;}
        @Override protected boolean beforeOpModeLoop(){if(loopLimit>0&&loopCount>=loopLimit){phase="STOP";return false;}loopCount++;return true;}
        @Override protected void reportOpModeException(Exception e){executionError=e.toString();}
    }
    private static class ObservedTelemetry extends TelemetryImpl {
        private String status;
        ObservedTelemetry(VirtualRobotController c){super(c);}
        @Override public synchronized Telemetry.Item addData(String caption,Object value){if(caption.equals(rule("key","Status")))status=String.valueOf(value);return super.addData(caption,value);}
        @Override public synchronized Telemetry.Item addData(String caption,String format,Object... args){if(caption.equals(rule("key","Status")))status=String.format(format,args);return super.addData(caption,format,args);}
        @Override public synchronized boolean update(){
            if(status!=null && events.size()<5000){events.add(phase+":"+status);status=null;}
            // Flush final stop telemetry before the upstream UI restores its hardware summary.
            if(phase.equals("STOP"))setMsTransmissionInterval(0);
            return super.update();
        }
    }
    private static <T> T fx(Callable<T> action) throws Exception {
        FutureTask<T> task=new FutureTask<>(action);Platform.runLater(task);return task.get(5,TimeUnit.SECONDS);
    }
    private static String json(String s){if(s==null)return "null";StringBuilder b=new StringBuilder("\"");for(char c:s.toCharArray()){switch(c){case '"':b.append("\\\"");break;case '\\':b.append("\\\\");break;case '\n':b.append("\\n");break;case '\r':b.append("\\r");break;case '\t':b.append("\\t");break;default:if(c<32)b.append(String.format("\\u%04x",(int)c));else b.append(c);}}return b.append('"').toString();}
    private static void write(String file,String text) throws Exception {
        Path next=work.resolve(file+".next");Files.writeString(next,text);Files.move(next,work.resolve(file),StandardCopyOption.REPLACE_EXISTING);
    }
    private static OpMode op() throws Exception {return (OpMode)get(controller,"opMode");}
    private static boolean alive() throws Exception {
        OpMode op=op();if(op==null)return false;
        Thread t=op instanceof LinearOpMode?(Thread)get(op,"runOpModeThread"):(Thread)get(controller,"opModeThread");return t!=null&&t.isAlive();
    }
    private static String error() throws Exception {
        if(!executionError.isEmpty())return executionError;
        OpMode op=op();if(op instanceof LinearOpMode){Object helper=get(op,"helper");if(helper!=null){Object e=get(helper,"exception");if(e!=null)return e.toString();}}
        return "";
    }
    private static void command(String command) throws Exception {
        switch(command){
            case "INIT": if(!phase.equals("READY"))return;phase="INIT";((Button)get(controller,"driverButton")).fire();break;
            case "START": if(!phase.equals("INIT"))return;if(!(Boolean)get(controller,"opModeInitialized")){phase="STOP";break;}phase="START";((Button)get(controller,"driverButton")).fire();break;
            case "STOP":
                if(phase.equals("READY")||phase.equals("STOP"))return;
                boolean cancelling=phase.equals("INIT");
                phase="STOP";
                if(!(Boolean)get(controller,"opModeInitialized"))break;
                if(!cancelling){((Button)get(controller,"driverButton")).fire();break;}
                // Let the upstream lifecycle leave INIT and invoke its own stop cleanup.
                controller.requestInitializationCancel();
                break;
            default:
                if(command.startsWith("PAD ")){
                    String[] values=command.split(" ");if(values.length!=5)return;
                    Object pad=get(controller,"virtualGamePadController");
                    set(pad,"left_stick_x",Float.parseFloat(values[1]));set(pad,"left_stick_y",Float.parseFloat(values[2]));set(pad,"right_stick_x",Float.parseFloat(values[3]));set(pad,"aPressed",values[4].equals("1"));
                }
        }
    }
    private static void snapshot() throws Exception {
        if((phase.equals("INIT")||phase.equals("START"))&&!(Boolean)get(controller,"opModeInitialized"))phase="STOP";
        VirtualBot bot=(VirtualBot)get(controller,"bot");
        ByteArrayOutputStream png=new ByteArrayOutputStream();
        ImageIO.write(SwingFXUtils.fromFXImage(controller.getFieldPane().snapshot(null,null),null),"png",png);
        StringBuilder motors=new StringBuilder("[");boolean first=true;
        HardwareMap hardware=bot.getHardwareMap();
        // Observe devices without changing student access rules. The OpMode thread can
        // deactivate hardware between the phase check and snapshot (e.g. an empty program).
        Map<String,DcMotor> devices=new HashMap<>((Map<String,DcMotor>)get(hardware.dcMotor,"map"));
        for(String name:devices.keySet()){
            DcMotor m=devices.get(name);if(!first)motors.append(',');first=false;
            motors.append("{\"name\":").append(json(name)).append(",\"power\":").append(m.getPower()).append(",\"encoder\":").append(m.getCurrentPosition()).append('}');
        }
        motors.append(']');
        String problem=error();if(!problem.isEmpty()){verdict="RE";detail=problem;}
        write("state.json","{\"revision\":"+(++revision)+",\"phase\":"+json(phase)+",\"telemetry\":"+json(lastTelemetry)+",\"telemetryLog\":"+json(telemetryLog)+",\"image\":"+json("data:image/png;base64,"+Base64.getEncoder().encodeToString(png.toByteArray()))+",\"x\":"+bot.getX()+",\"y\":"+bot.getY()+",\"heading\":"+bot.getHeadingRadians()+",\"motors\":"+motors+",\"error\":"+json(problem)+"}");
    }
    private static void auto(String scenario) throws Exception {
        boolean grade=!scenario.equals("run"), iterative=scenario.startsWith("iterative");
        String readyEvent="INIT:"+rule("ready","Ready"),runningEvent="START:"+rule("running","Running"),stoppedEvent="STOP:"+rule("stopped","Stopped");
        boolean requireStopped=Boolean.parseBoolean(rule("requireStopped",String.valueOf(iterative)));
        if(grade&&iterative)loopLimit=Integer.parseInt(scenario.substring("iterative-".length()));
        if(grade){
            TeleOp a=student.getAnnotation(TeleOp.class);
            if(a==null||!a.name().equals(rule("annotation",iterative?"IterativeDemo":"MyFirstOp"))){verdict="WA";detail="注解名称不符合配置";return;}
            if(LinearOpMode.class.isAssignableFrom(student)==iterative){verdict="WA";detail="OpMode 类型不符合配置";return;}
        }
        fx(()->{command("INIT");return null;});Thread.sleep(duration("initMs",450));
        if(grade&&(!events.equals(List.of(readyEvent))||!alive())){verdict="WA";detail="INIT 应发送一次配置的就绪状态并等待开始";}
        if(scenario.equals("cancel"))fx(()->{command("STOP");return null;});
        else {
            fx(()->{command("START");return null;});
            if(grade&&iterative){
                // The loop hook ends this lifecycle after exactly N calls. A fixed
                // observation delay can send STOP in the middle of a valid loop.
                Thread worker=(Thread)get(controller,"opModeThread");
                worker.join(10000);
                if(worker.isAlive()){verdict="TLE";detail="规定次数的 loop 未在 10 秒内完成，请检查阻塞或无限循环";}
            }else Thread.sleep(duration("runMs",450));
            if(grade&&!iterative&&!alive()){verdict="WA";detail="应保持活动直到 STOP";}
            fx(()->{command("STOP");return null;});
        }
        Thread.sleep(duration("stopMs",1150));
        String err=error();if(!err.isEmpty()){verdict="RE";detail=err;}
        if(alive()){verdict="TLE";detail="STOP 后程序未退出";}
        if(grade&&verdict.isEmpty()){
            List<String> trace;synchronized(events){trace=new ArrayList<>(events);}
            if(scenario.equals("cancel")){
                if(trace.stream().anyMatch(s->!s.equals(readyEvent))){verdict="WA";detail="取消初始化后不应继续发送其他状态";}
            }else{
                long running=trace.stream().filter(s->s.equals(runningEvent)).count();
                if(iterative?running!=loopLimit:running<duration("minRunning",2)){verdict="WA";detail=iterative?"每次 loop 应更新一次配置的运行状态":"运行状态更新次数不足";}
                if(trace.stream().anyMatch(s->!s.equals(readyEvent)&&!s.equals(runningEvent)&&!s.equals(stoppedEvent)&&!(!iterative&&s.equals("STOP:"+rule("running","Running"))))){verdict="WA";detail="telemetry 状态与生命周期阶段不匹配";}
                if(requireStopped&&trace.stream().filter(s->s.equals(stoppedEvent)).count()!=1){verdict="WA";detail="STOP 应更新一次配置的停止状态";}
            }
        }
        if(verdict.isEmpty()){verdict=grade?"AC":"RUN";detail=grade?"Beta8397 仿真行为检查通过":"Beta8397 仿真运行结束";}
    }
    public static void main(String[] args) throws Exception {
        work=Path.of(args[0]);String scenario=args.length>3?args[3]:"interactive";
        if(Files.exists(work.resolve("rules.properties")))try(Reader reader=Files.newBufferedReader(work.resolve("rules.properties"))){rules.load(reader);}
        CountDownLatch ready=new CountDownLatch(1);Platform.startup(ready::countDown);ready.await();Platform.setImplicitExit(false);
        try {
            fx(()->{
                FXMLLoader loader=new FXMLLoader(VirtualRobotController.class.getResource("virtual_robot.fxml"));
                loader.setControllerFactory(type->{try{return type==VirtualRobotController.class?new WebController():type.getDeclaredConstructor().newInstance();}catch(Exception e){throw new RuntimeException(e);}});
                Parent root=loader.load();controller=loader.getController();new Scene(root);root.applyCss();root.layout();
                ((ComboBox<Class<?>>)get(controller,"cbxConfig")).setValue(MecanumBot.class);controller.setConfig(null);
                URLClassLoader userLoader=new URLClassLoader(new URL[]{work.resolve("classes").toUri().toURL()},BetaBridge.class.getClassLoader());
                student=Class.forName(args[1],false,userLoader);
                if(!OpMode.class.isAssignableFrom(student))throw new IllegalArgumentException("需要 OpMode 或 LinearOpMode");
                ((ComboBox<Class<?>>)get(controller,"cbxOpModes")).setValue(student);
                snapshot();return null;
            });
            if(!scenario.equals("interactive")){auto(scenario);fx(()->{snapshot();return null;});write("result.json","{\"status\":"+json(verdict)+",\"message\":"+json(detail)+"}");}
            else {
                Thread input=new Thread(()->{try(BufferedReader reader=new BufferedReader(new InputStreamReader(System.in))){String line;while((line=reader.readLine())!=null){if(line.equals("QUIT"))System.exit(0);String cmd=line;fx(()->{command(cmd);snapshot();return null;});}System.exit(0);}catch(Exception e){e.printStackTrace();System.exit(1);}});input.setDaemon(true);input.start();
                for(int i=0;i<2400;i++){Thread.sleep(250);fx(()->{snapshot();return null;});}
            }
        } catch(Throwable e){e.printStackTrace();write("result.json","{\"status\":\"RE\",\"message\":"+json(e.toString())+"}");}
        System.exit(0);
    }
}
