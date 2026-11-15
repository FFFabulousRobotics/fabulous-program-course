package fabulous;

import com.sun.source.tree.*;
import com.sun.source.util.*;
import java.io.*;
import java.lang.reflect.*;
import java.net.URLClassLoader;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;

/** Trusted W6 rubric. Parsing never loads student classes; execution is sandboxed. */
public final class W6Harness {
    static Class<?> soda, foreign;
    static Constructor<?> baseCtor, foreignCtor;
    static Method match;
    static final Map<String,Field> fields=new HashMap<>();
    static final Map<String,Method> methods=new HashMap<>();
    static final class LimitedOutput extends ByteArrayOutputStream {
        public synchronized void write(int b) { check(count<65536,"方法输出超过64KB");super.write(b); }
        public synchronized void write(byte[] b,int off,int len) { check(count+len<=65536,"方法输出超过64KB");super.write(b,off,len); }
    }
    static final LimitedOutput stdout=new LimitedOutput(),stderr=new LimitedOutput();
    interface Action {void run() throws Exception;}
    static void check(boolean ok,String why) {if(!ok)throw new AssertionError(why);}
    static void load() throws Exception {
        soda=Class.forName("Soda");foreign=Class.forName("ForeignTraveler");
        baseCtor=soda.getDeclaredConstructor(String.class,int.class,char.class,int.class,int.class);baseCtor.setAccessible(true);
        foreignCtor=foreign.getDeclaredConstructor(String.class,int.class,char.class,int.class,int.class,String.class);foreignCtor.setAccessible(true);
        match=soda.getDeclaredMethod("canMatch",soda);match.setAccessible(true);
    }
    static Object create(boolean f,String name,int gender,char property,int height,int charm) throws Exception {
        return f?foreignCtor.newInstance(name,gender,property,height,charm,"纳塔"):baseCtor.newInstance(name,gender,property,height,charm);
    }
    static Field field(String name) throws Exception {
        if(!fields.containsKey(name)) {Field f=(name.equals("origin")?foreign:soda).getDeclaredField(name);f.setAccessible(true);fields.put(name,f);}
        return fields.get(name);
    }
    static Object value(Object o,String name) throws Exception {return field(name).get(o);}
    static int number(Object o,String name) throws Exception {return field(name).getInt(o);}
    static Object call(Object o,String name,Object... args) throws Exception {
        String key=name+"/"+args.length;
        if(!methods.containsKey(key)) {
            Class<?>[] types=args.length==0?new Class<?>[0]:new Class<?>[]{args[0] instanceof String?String.class:int.class};
            Method m=soda.getDeclaredMethod(name,types);m.setAccessible(true);methods.put(key,m);
        }
        return methods.get(key).invoke(o,args);
    }
    static boolean accepts(Object a,Object other) throws Exception {return (boolean)match.invoke(a,other);}
    static String capture(Action action) throws Exception {
        stdout.reset();stderr.reset();action.run();check(stderr.size()==0,"方法不得输出额外标准错误");
        return stdout.toString(StandardCharsets.UTF_8).replace("\r\n","\n");
    }
    static void silent(Action action) throws Exception {check(capture(action).isEmpty(),"构造、getter、setter及canMatch均须静默");}
    static void fieldContract(String name,Class<?> type) throws Exception {
        Field f=field(name);check(f.getType()==type&&Modifier.isPrivate(f.getModifiers())&&!Modifier.isStatic(f.getModifiers()),"字段 "+name+" 必须是指定类型的private实例字段");
    }
    static void methodContract(Class<?> owner,String name,Class<?> result,Class<?>... args) throws Exception {
        Method m=owner.getDeclaredMethod(name,args);
        check(m.getReturnType()==result&&Modifier.isPublic(m.getModifiers())&&!Modifier.isStatic(m.getModifiers()),"方法 "+name+" 的public实例接口不正确");
    }
    static void schema() throws Exception {
        check(foreign.getSuperclass()==soda,"ForeignTraveler必须继承Soda");
        fieldContract("name",String.class);fieldContract("gender",int.class);fieldContract("property",char.class);fieldContract("height",int.class);fieldContract("charm",int.class);fieldContract("origin",String.class);
        check(Modifier.isPublic(baseCtor.getModifiers())&&Modifier.isPublic(foreignCtor.getModifiers()),"两个构造方法均须public");
        methodContract(soda,"getName",String.class);methodContract(soda,"getGender",int.class);methodContract(soda,"getProperty",char.class);methodContract(soda,"getHeight",int.class);methodContract(soda,"getCharm",int.class);
        methodContract(soda,"setHeight",void.class,int.class);methodContract(soda,"setCharm",void.class,int.class);
        methodContract(soda,"canMatch",boolean.class,soda);methodContract(foreign,"canMatch",boolean.class,soda);
        methodContract(soda,"showInfo",void.class);methodContract(soda,"showInfo",void.class,String.class);methodContract(foreign,"showInfo",void.class);
    }
    static Map<String,ClassTree> classes(String source) throws Exception {
        CompilationUnitTree unit=SodaHarness.parse(Files.readString(Path.of(source)),new JavacTask[1]);
        Map<String,ClassTree> result=new HashMap<>();
        for(Tree t:unit.getTypeDecls())if(t instanceof ClassTree c)result.put(c.getSimpleName().toString(),c);
        return result;
    }
    static MethodTree methodTree(ClassTree cls,String name,int count) {
        check(cls!=null,"缺少指定作答类");
        for(Tree t:cls.getMembers())if(t instanceof MethodTree m&&m.getName().contentEquals(name)&&m.getParameters().size()==count)return m;
        throw new AssertionError("缺少方法 "+name);
    }
    static void override(MethodTree m) {check(m.getModifiers().getAnnotations().stream().anyMatch(a->a.getAnnotationType().toString().equals("Override")||a.getAnnotationType().toString().equals("java.lang.Override")),"重写方法须保留@Override");}
    static void syntax(String part,String source) throws Exception {
        // Called in a process whose classpath contains trusted harnesses only.
        Map<String,ClassTree> cs=classes(source);
        if(part.equals("part1")) {
            MethodTree ctor=methodTree(cs.get("Soda"),"<init>",5);Set<String> assigned=new HashSet<>();
            new TreeScanner<Void,Void>() {public Void visitAssignment(AssignmentTree a,Void unused) {assigned.add(a.getVariable().toString());return super.visitAssignment(a,unused);}}.scan(ctor.getBody(),null);
            for(String field:List.of("name","gender","property","height","charm"))check(assigned.contains("this."+field),"Soda构造须用this初始化 "+field);
            MethodTree child=methodTree(cs.get("ForeignTraveler"),"<init>",6);
            check(child.getBody()!=null&&!child.getBody().getStatements().isEmpty()&&child.getBody().getStatements().get(0).toString().stripLeading().startsWith("super("),"子类构造第一条语句须调用super(...)");
        } else if(part.equals("part4")) {
            MethodTree m=methodTree(cs.get("ForeignTraveler"),"canMatch",1);override(m);boolean[] found={false};
            new TreeScanner<Void,Void>() {public Void visitMethodInvocation(MethodInvocationTree c,Void unused) {if(c.getMethodSelect().toString().equals("super.canMatch"))found[0]=true;return super.visitMethodInvocation(c,unused);}}.scan(m.getBody(),null);
            check(found[0],"子类canMatch须调用super.canMatch(other)");
        } else if(part.equals("part5")) {
            override(methodTree(cs.get("ForeignTraveler"),"showInfo",0));methodTree(cs.get("Soda"),"showInfo",1);
        } else if(part.equals("part6")) {
            ClassTree main=cs.get("Main");check(main!=null,"缺少Main");Set<String> arrays=new HashSet<>(),refs=new HashSet<>();
            new TreeScanner<Void,Void>() {public Void visitVariable(VariableTree v,Void unused) {if(v.getType()!=null){if(v.getType().toString().equals("Soda[]"))arrays.add(v.getName().toString());if(v.getType().toString().equals("Soda"))refs.add(v.getName().toString());}return super.visitVariable(v,unused);}}.scan(main,null);
            int[] calls={0,0};
            new TreeScanner<Void,Void>() {public Void visitMethodInvocation(MethodInvocationTree c,Void unused) {
                if(c.getMethodSelect() instanceof MemberSelectTree select) {
                    ExpressionTree target=select.getExpression();boolean typed=refs.contains(target.toString())||(target instanceof ArrayAccessTree a&&arrays.contains(a.getExpression().toString()));
                    if(typed&&select.getIdentifier().contentEquals("canMatch")&&c.getArguments().size()==1)calls[0]++;
                    if(typed&&select.getIdentifier().contentEquals("showInfo")&&c.getArguments().isEmpty())calls[1]++;
                }return super.visitMethodInvocation(c,unused);
            }}.scan(main,null);
            check(!arrays.isEmpty()&&calls[0]>=2&&calls[1]>=1,"Main须使用Soda[]和Soda类型引用进行双向canMatch及无参showInfo调用");
        } else throw new AssertionError("未知语法评分项");
    }
    static void state(Object o,String name,int gender,char property,int height,int charm,boolean f) throws Exception {
        check(Objects.equals(value(o,"name"),name)&&Objects.equals(value(o,"gender"),gender)&&Objects.equals(value(o,"property"),property)&&number(o,"height")==height&&number(o,"charm")==charm,"构造参数未正确保存在实例字段");
        if(f)check(Objects.equals(value(o,"origin"),"纳塔"),"origin未正确初始化");
    }
    static void constructors() throws Exception {
        silent(()->{for(boolean f:new boolean[]{false,true})for(int gender=0;gender<=1;gender++)for(char property:new char[]{'A','B','C','D'})for(int charm:new int[]{1,90,100,120,Integer.MAX_VALUE}) {
            Object a=create(f,"构造甲",gender,property,155,charm),b=create(f,"构造乙",1-gender,'A',170,81);
            state(a,"构造甲",gender,property,155,charm,f);state(b,"构造乙",1-gender,'A',170,81,f);
        }});
    }
    static void setters() throws Exception {
        silent(()->{for(boolean f:new boolean[]{false,true}) {
            Object a=create(f,"甲",1,'C',170,80),b=create(f,"乙",0,'B',180,90);
            check(call(a,"getName").equals("甲")&&(int)call(a,"getGender")==1&&(char)call(a,"getProperty")=='C'&&(int)call(a,"getHeight")==170&&(int)call(a,"getCharm")==80,"getter须返回真实构造状态");
            for(int v:new int[]{-1,Integer.MIN_VALUE}){call(a,"setHeight",v);check(number(a,"height")==170,"负身高须保留原值");}
            call(a,"setHeight",0);check(number(a,"height")==0,"setHeight允许0");call(a,"setHeight",Integer.MAX_VALUE);check(number(a,"height")==Integer.MAX_VALUE,"setHeight应保存合法正数");
            for(int v:new int[]{-1,101,Integer.MAX_VALUE}){call(a,"setCharm",v);check(number(a,"charm")==80,"非法魅力须保持原值");}
            call(a,"setCharm",0);check(number(a,"charm")==0,"setCharm允许0");call(a,"setCharm",100);check(number(a,"charm")==100,"setCharm允许100");
            check((int)call(a,"getHeight")==Integer.MAX_VALUE&&(int)call(a,"getCharm")==100,"getter须反映修改后状态");state(b,"乙",0,'B',180,90,f);
            Object high=create(f,"高魅力",1,'A',164,120);call(high,"setCharm",101);check((int)call(high,"getCharm")==120,"构造魅力可大于100，非法setter应保留该原值");
        }});
    }
    static boolean gender(char p,int a,int b) {return p=='A'||p=='B'&&a==b||p=='C'&&a!=b;}
    static boolean expected(char p,int g,int h,int c,char op,int og,int oh,int oc) {return p=='D'?(op=='D'||gender(op,g,og)&&oh<h&&oc>c):gender(p,g,og);}
    static void matching(boolean f) throws Exception {
        silent(()->{for(char p:new char[]{'A','B','C','D'})for(char op:new char[]{'A','B','C','D'})for(int g=0;g<=1;g++)for(int og=0;og<=1;og++)for(int h:new int[]{160,165,170})for(int oh:new int[]{159,160,161,164,165,166})for(int c:new int[]{0,90,100})for(int oc:new int[]{0,89,90,91,100}) {
            Object a=create(f,"当前",g,p,h,c),other=create(false,"对方",og,op,oh,oc);
            boolean want=expected(p,g,h,c,op,og,oh,oc)&&(!f||oh>160);
            check(accepts(a,other)==want,f?"Foreign须先检查对方身高160/161，再复用父类规则":"Soda的A/B/C/D、D-D特例或严格身高魅力条件错误");
            state(a,"当前",g,p,h,c,f);state(other,"对方",og,op,oh,oc,false);
        }});
    }
    static String snapshot(Object o,boolean f) throws Exception {return value(o,"name")+"|"+value(o,"gender")+"|"+value(o,"property")+"|"+value(o,"height")+"|"+value(o,"charm")+(f?"|"+value(o,"origin"):"");}
    static void display() throws Exception {
        for(boolean f:new boolean[]{false,true})for(int height:new int[]{0,155,170})for(int charm:new int[]{0,95,120}) {
            Object a=create(f,"嘉宾",1,'C',height,charm);String before=snapshot(a,f),body="嘉宾 1 C "+height+" "+charm;
            check(capture(()->call(a,"showInfo")).equals((f?"异乡旅行者 ":"本地盐汽水 ")+body+(f?" 来自:纳塔":"")+"\n"),"无参showInfo须按实际对象类型输出真实状态、单空格及一次换行");
            check(capture(()->call(a,"showInfo","测试前缀")).equals("测试前缀 "+body+"\n"),"带参showInfo重载须使用给定prefix，不附origin");
            check(snapshot(a,f).equals(before),"showInfo不得改变状态");
            call(a,"setHeight",1);call(a,"setCharm",100);
            check(capture(()->call(a,"showInfo")).equals((f?"异乡旅行者 ":"本地盐汽水 ")+"嘉宾 1 C 1 100"+(f?" 来自:纳塔":"")+"\n"),"输出须反映setter修改后的字段");
        }
    }
    static String output(String value) {String s=value.replace("\r\n","\n");return s.endsWith("\n")?s.substring(0,s.length()-1):s;}
    static void mainCases(String classDir,String fixtures) throws Exception {
        InputStream original=System.in;int count=0;
        try {for(String line:Files.readAllLines(Path.of(fixtures),StandardCharsets.UTF_8)) {
            if(line.isBlank())continue;String[] pair=line.split("\\|",-1);check(pair.length==2,"可信测试文件无效");
            byte[] input=Base64.getDecoder().decode(pair[0]);String expected=new String(Base64.getDecoder().decode(pair[1]),StandardCharsets.UTF_8);
            // Fresh student classloader per case, preserving standalone JVM static semantics.
            try(URLClassLoader loader=new URLClassLoader(new java.net.URL[]{Path.of(classDir).toUri().toURL()},ClassLoader.getPlatformClassLoader())) {
                Class<?> main=loader.loadClass("Main");Method entry=main.getDeclaredMethod("main",String[].class);
                check(Modifier.isPublic(entry.getModifiers())&&Modifier.isStatic(entry.getModifiers())&&entry.getReturnType()==void.class,"Main入口签名错误");
                System.setIn(new ByteArrayInputStream(input));
                String actual=capture(()->entry.invoke(null,(Object)new String[0]));
                check(output(actual).equals(output(expected)),"Main双向匹配、首位选择或输出格式不正确（含样例及边界）");count++;
            }
        }} finally {System.setIn(original);}
        check(count==21,"可信测试用例数量不一致");
    }
    public static void main(String[] args) throws Exception {
        System.setOut(new PrintStream(stdout,true,StandardCharsets.UTF_8));System.setErr(new PrintStream(stderr,true,StandardCharsets.UTF_8));String result;
        try {
            if(args[0].startsWith("syntax-"))syntax(args[0].substring(7),args[2]);
            else if(args[0].equals("part6"))mainCases(args[3],args[4]);
            else {load();switch(args[0]) {
                case "part0":schema();break;case "part1":constructors();break;case "part2":setters();break;
                case "part3":matching(false);break;case "part4":matching(true);break;case "part5":display();break;
                default:throw new AssertionError("未知W6评分项");
            }}
            result="AC|本评分项通过：结构、对象状态或实际输出符合要求";
        } catch(Throwable e) {
            while((e instanceof InvocationTargetException||e instanceof ExceptionInInitializerError)&&e.getCause()!=null)e=e.getCause();
            result=(e instanceof AssertionError?"WA|":"RE|")+(e.getMessage()==null?e.getClass().getSimpleName():e.getMessage());
        }
        Files.writeString(Path.of(args[1]),result,StandardCharsets.UTF_8);
    }
}
