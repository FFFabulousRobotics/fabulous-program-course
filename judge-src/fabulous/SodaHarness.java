package fabulous;

import com.sun.source.tree.*;
import com.sun.source.util.*;
import javax.tools.*;
import java.io.*;
import java.lang.reflect.*;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;

/** Trusted W4 rubric: syntax-tree contract plus direct inspection of object state. */
public final class SodaHarness {
    static Class<?> soda;
    static Field hp, potions;
    static Constructor<?> constructor;
    static Method hurt, heal, show;
    static final ByteArrayOutputStream captured = new ByteArrayOutputStream();
    static void check(boolean ok, String why) { if (!ok) throw new AssertionError(why); }
    static int life(Object o) throws Exception { return hp.getInt(o); }
    static int stock() throws Exception { return potions.getInt(null); }
    static void reset() throws Exception { potions.setInt(null, 2); captured.reset(); }
    static Object create(int initial) throws Exception { return constructor.newInstance(initial); }
    static void hit(Object o, int damage) throws Exception { hurt.invoke(o, damage); }
    static void treat(Object o) throws Exception { heal.invoke(o); }
    static void load() throws Exception {
        soda=Class.forName("Soda");
        hp=soda.getDeclaredField("hp");potions=soda.getDeclaredField("potions");
        hp.setAccessible(true);potions.setAccessible(true);
        constructor=soda.getDeclaredConstructor(int.class);constructor.setAccessible(true);
        hurt=soda.getDeclaredMethod("hurt",int.class);heal=soda.getDeclaredMethod("heal");show=soda.getDeclaredMethod("show");
        hurt.setAccessible(true);heal.setAccessible(true);show.setAccessible(true);
    }
    static CompilationUnitTree parse(String source, JavacTask[] holder) throws Exception {
        JavaCompiler compiler=ToolProvider.getSystemJavaCompiler();
        JavaFileObject file=new SimpleJavaFileObject(URI.create("string:///Main.java"),JavaFileObject.Kind.SOURCE){
            public CharSequence getCharContent(boolean ignore){return source;}
        };
        DiagnosticCollector<JavaFileObject> diagnostics=new DiagnosticCollector<>();
        JavacTask task=(JavacTask)compiler.getTask(null,null,diagnostics,List.of("-proc:none"),null,List.of(file));
        holder[0]=task;
        return task.parse().iterator().next();
    }
    static String fixedStructure(String source) throws Exception {
        JavacTask[] task=new JavacTask[1];CompilationUnitTree unit=parse(source,task);
        SourcePositions positions=Trees.instance(task[0]).getSourcePositions();
        List<int[]> bodies=new ArrayList<>();
        for(Tree decl:unit.getTypeDecls()) if(decl instanceof ClassTree cls && cls.getSimpleName().contentEquals("Soda")) {
            for(Tree member:cls.getMembers())if(member instanceof MethodTree method && method.getBody()!=null &&
                List.of("<init>","hurt","heal","show").contains(method.getName().toString())) {
                bodies.add(new int[]{(int)positions.getStartPosition(unit,method.getBody()),(int)positions.getEndPosition(unit,method.getBody())});
            }
        }
        check(bodies.size()==4,"必须保留一个构造方法及 hurt、heal、show 三个方法");
        bodies.sort((a,b)->Integer.compare(b[0],a[0]));StringBuilder stripped=new StringBuilder(source);
        for(int[] span:bodies)stripped.replace(span[0],span[1],"{}");
        return parse(stripped.toString(),new JavacTask[1]).toString();
    }
    static String mainTree(String source) throws Exception {
        CompilationUnitTree unit=parse(source,new JavacTask[1]);
        List<String> found=new ArrayList<>();
        for(Tree decl:unit.getTypeDecls())if(decl instanceof ClassTree cls && cls.getSimpleName().contentEquals("Main"))found.add(cls.toString());
        check(found.size()==1,"必须保留唯一的固定 Main 主程序");
        return found.get(0);
    }
    static void grade(String scenario, String source, String starter) throws Exception {
        if(scenario.equals("main-contract")) {
            check(mainTree(Files.readString(Path.of(source))).equals(mainTree(Files.readString(Path.of(starter)))), "Main 主程序不可修改；请只在作答区补全 Soda 类");
            return;
        }
        if(scenario.equals("structure")) {
            check(fixedStructure(Files.readString(Path.of(source))).equals(fixedStructure(Files.readString(Path.of(starter)))),
                "只允许补全四个方法体；字段、方法签名、Main 及其他结构须保持原样（注释和排版不计）");
            return;
        }
        load();
        switch(scenario) {
            case "constructor":
                check(!Modifier.isStatic(hp.getModifiers()),"hp 应为各对象独立的实例字段");
                check(Modifier.isStatic(potions.getModifiers()),"potions 应为共享类字段");
                for(int n=0;n<=10;n++) {
                    reset();Object a=create(n);potions.setInt(null,1);Object b=create(10-n);
                    check(life(a)==n && life(b)==10-n,"构造参数未正确保存，或新对象覆盖了旧对象的生命");
                    check(stock()==1,"创建对象不能重新补充共享药水");
                }
                break;
            case "hurt":
                for(int n=0;n<=10;n++)for(int d:new int[]{0,1,3,8,10,11,30,Integer.MAX_VALUE}) {
                    reset();Object a=create(n),b=create(7);hit(a,d);
                    check(life(a)==Math.max(0,n-d),"零伤害、普通伤害或归零边界处理不正确");
                    check(life(b)==7 && stock()==2,"扣血不能影响其他对象或药水数量");
                }
                break;
            case "eligibility":
                for(int n:new int[]{0,10}) {
                    reset();Object a=create(n);treat(a);treat(a);
                    check(life(a)==n && stock()==2,"死亡或满血时治疗必须无效，且不能耗药");
                }
                for(int n=0;n<=10;n++) {
                    reset();Object a=create(n);potions.setInt(null,0);treat(a);
                    check(life(a)==n && stock()==0,"无药时不得回血，库存不得变为负数");
                }
                break;
            case "recovery":
                for(int n=1;n<10;n++) {
                    reset();Object a=create(n);treat(a);
                    check(life(a)==Math.min(10,n+3),"每次有效治疗恢复3点，且生命不能超过10");
                    check(stock()==1,"每次有效治疗应恰好消耗1瓶药");
                }
                break;
            case "shared":
                for(int n=1;n<=6;n++) {
                    reset();Object a=create(n),b=create(2);treat(a);
                    check(life(b)==2 && stock()==1,"治疗一个对象不能改变另一个对象生命；库存应共享");
                    Object c=create(4);check(stock()==1,"新增对象不应重置药水");treat(b);
                    check(stock()==0 && life(b)==5,"两次有效治疗必须用完同一库存");
                    treat(c);treat(a);check(life(c)==4 && life(a)==n+3 && stock()==0,"药水用尽后，所有对象均不可继续治疗");
                }
                break;
            case "output":
                for(int n=0;n<=10;n++) {
                    reset();Object a=create(n);hit(a,0);treat(a);
                    check(captured.size()==0,"构造、hurt 和 heal 不得输出内容");
                    for(int stock=0;stock<=2;stock++) {
                        hp.setInt(a,n);potions.setInt(null,stock);captured.reset();show.invoke(a);
                        check(captured.toString(StandardCharsets.UTF_8).replace("\r\n","\n").equals(n+" "+stock+"\n"),"show 必须报告真实生命与共享余药，以单个空格分隔并换行");
                        check(life(a)==n && stock()==stock,"show 不能修改对象状态");
                    }
                }
                break;
            default: throw new IllegalArgumentException("Unknown rubric");
        }
    }
    public static void main(String[] args) throws Exception {
        String result;
        System.setOut(new PrintStream(captured,true,StandardCharsets.UTF_8));
        try { grade(args[0],args[2],args[3]);result="AC|本评分项通过：结构或对象状态符合要求"; }
        catch(Throwable e) {
            while(e instanceof InvocationTargetException && e.getCause()!=null)e=e.getCause();
            result=(e instanceof AssertionError?"WA|":"RE|")+(e.getMessage()==null?e.getClass().getSimpleName():e.getMessage());
        }
        Files.writeString(Path.of(args[1]),result);
    }
}
