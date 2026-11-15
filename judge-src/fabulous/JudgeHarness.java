package fabulous;

import com.qualcomm.robotcore.eventloop.opmode.*;
import org.firstinspires.ftc.robotcore.external.Telemetry;
import java.lang.reflect.*;
import java.nio.file.*;
import java.security.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicReference;

/** Drives unmodified official FTC classes. Only DS events and telemetry transport are simulated. */
public final class JudgeHarness {
    static volatile String phase = "INIT";
    static boolean preview = false;
    static int telemetryLines = 0;
    static final List<String> events = Collections.synchronizedList(new ArrayList<>());
    static final Map<String,String> pending = Collections.synchronizedMap(new LinkedHashMap<>());
    static Field field(Class<?> type, String name) throws Exception {
        while (type != null) {
            try { Field f=type.getDeclaredField(name); f.setAccessible(true); return f; }
            catch (NoSuchFieldException e) { type=type.getSuperclass(); }
        }
        throw new NoSuchFieldException(name);
    }
    static Object telemetry(Class<?> type) {
        return Proxy.newProxyInstance(JudgeHarness.class.getClassLoader(), new Class<?>[]{type}, (proxy, method, args) -> {
            switch(method.getName()) {
                case "addData": pending.put(String.valueOf(args[0]), String.valueOf(args[1])); break;
                case "addLine": if(args!=null && args.length>0) pending.put("Line",String.valueOf(args[0])); break;
                case "update":
                    synchronized(pending) {
                        if(preview && !pending.isEmpty()) {
                            if(telemetryLines<100) System.out.println("[telemetry / "+phase+"] "+pending);
                            else if(telemetryLines==100) System.out.println("[telemetry] 后续更新已省略（最多显示 100 条）");
                            if(telemetryLines<=100) telemetryLines++;
                        }
                        if(pending.containsKey("Status") && events.size()<10000) events.add(phase+":"+pending.get("Status")); pending.clear();
                    }
                    return true;
                case "toString": return "Desktop telemetry transport";
            }
            Class<?> result=method.getReturnType();
            if (result.isInterface()) return telemetry(result);
            if (result==boolean.class) return false;
            if (result==int.class) return 0;
            return null;
        });
    }
    static void setStarted(OpMode op) throws Exception {
        field(op.getClass(),"isStarted").setBoolean(op,true);
        Object notifier=field(op.getClass(),"runningNotifier").get(op);
        synchronized(notifier) { notifier.notifyAll(); }
    }
    static String ftc(Class<?> type, String kind, String scenario) throws Exception {
        TeleOp annotation=type.getAnnotation(TeleOp.class);
        String name=kind.equals("linear")?"MyFirstOp":"IterativeDemo";
        if(annotation==null || !annotation.name().equals(name)) return "WA|请使用 @TeleOp(name = \""+name+"\")";
        if(!OpMode.class.isAssignableFrom(type)) return "WA|必须继承 FTC OpMode";
        OpMode op=(OpMode)type.getDeclaredConstructor().newInstance();
        op.telemetry=(Telemetry)telemetry(Telemetry.class);
        if(kind.equals("linear")) {
            if(!(op instanceof LinearOpMode)) return "WA|必须继承 LinearOpMode";
            AtomicReference<Throwable> error=new AtomicReference<>();
            Thread worker=new Thread(()->{try { ((LinearOpMode)op).runOpMode(); } catch(Throwable e) { error.set(e); }});
            worker.setDaemon(true); worker.start();
            long readyDeadline=System.nanoTime()+1_000_000_000L;
            while(worker.isAlive() && events.isEmpty() && System.nanoTime()<readyDeadline) Thread.sleep(5);
            Thread.sleep(40);
            if(error.get()!=null) throw new RuntimeException(error.get());
            if(!worker.isAlive() || !events.equals(List.of("INIT:Ready"))) return "WA|INIT 需要只发送一次 Ready，然后等待 START";
            if(scenario.equals("cancel")) {
                field(type,"stopRequested").setBoolean(op,true); worker.interrupt(); worker.join(600);
                if(worker.isAlive()) return "WA|初始化取消后没有退出";
                if(events.stream().anyMatch(e->e.endsWith(":Running"))) return "WA|取消后不应进入 Running";
            } else {
                phase="START"; setStarted(op); Thread.sleep(100);
                if(!worker.isAlive()) return "WA|程序应保持活动，直到 STOP 到来后退出";
                field(type,"stopRequested").setBoolean(op,true); worker.join(600);
                if(worker.isAlive()) return "WA|STOP 后活动循环没有退出";
                if(events.stream().filter(e->e.equals("START:Running")).count()<2) return "WA|START 后应持续发送 Running 并 update";
                if(events.stream().anyMatch(e->!e.equals("INIT:Ready")&&!e.equals("START:Running"))) return "WA|状态内容或阶段不匹配";
            }
            if(error.get()!=null && !(error.get() instanceof InterruptedException)) throw new RuntimeException(error.get());
        } else {
            if(op instanceof LinearOpMode) return "WA|本题需要继承迭代式 OpMode";
            int count=Integer.parseInt(scenario);
            op.init(); op.start(); phase="LOOP";
            for(int i=0;i<count;i++) op.loop();
            phase="STOP"; op.stop();
            List<String> expected=new ArrayList<>(); expected.add("INIT:Ready");
            for(int i=0;i<count;i++) expected.add("LOOP:Running"); expected.add("STOP:Stopped");
            if(!events.equals(expected)) return "WA|期望 "+expected+"；实际 "+events;
        }
        return "AC|官方 SDK 编译及生命周期行为测试通过";
    }
    // A desktop driver session for Run: no annotations, answer comparison or scoring.
    static String runFtc(Class<?> type) throws Exception {
        if(!OpMode.class.isAssignableFrom(type)) throw new IllegalArgumentException("机器人程序必须继承 OpMode 或 LinearOpMode");
        OpMode op=(OpMode)type.getDeclaredConstructor().newInstance();
        op.telemetry=(Telemetry)telemetry(Telemetry.class);
        if(op instanceof LinearOpMode) {
            AtomicReference<Throwable> error=new AtomicReference<>();
            Thread worker=new Thread(()->{try { ((LinearOpMode)op).runOpMode(); } catch(Throwable e) { error.set(e); }});
            worker.setDaemon(true);worker.start();Thread.sleep(200);
            phase="START";setStarted(op);Thread.sleep(200);
            phase="STOP";field(type,"stopRequested").setBoolean(op,true);worker.join(600);
            if(worker.isAlive()) {worker.interrupt();return "TLE|发送 STOP 后程序仍未结束";}
            if(error.get()!=null) throw new RuntimeException(error.get());
        } else {
            op.init();op.start();phase="LOOP";
            for(int i=0;i<3;i++)op.loop();
            phase="STOP";op.stop();
        }
        return "RUN|桌面运行结束（模拟 INIT / START / STOP，未连接实体机器人）";
    }
    @SuppressWarnings("removal")
    public static void main(String[] args) throws Exception {
        String report=args[3], result;
        preview=args.length>4 && args[4].equals("run");
        try {
            Class<?> type=Class.forName(args[0]);
            if(args[1].equals("java")) { type.getMethod("main",String[].class).invoke(null,(Object)new String[0]); result="RUN|程序正常退出"; }
            else result=preview?runFtc(type):ftc(type,args[1],args[2]);
        } catch(Throwable e) {
            Throwable cause=e;
            while(cause.getCause()!=null) cause=cause.getCause();
            result="RE|"+cause.getClass().getSimpleName()+": "+cause.getMessage();
        }
        final String answer=result;
        AccessController.doPrivileged((PrivilegedExceptionAction<Void>)()->{ Files.writeString(Path.of(report),answer); return null; });
    }
}
