package fabulous;

import com.sun.source.tree.*;
import com.sun.source.util.*;
import java.io.*;
import java.lang.reflect.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;

/** Trusted W5 rubrics: invoke methods and inspect actual private object state. */
public final class W5Harness {
    static Class<?> cls;
    static String variant;
    static int initialStock;
    static final ByteArrayOutputStream stdout=new ByteArrayOutputStream(),stderr=new ByteArrayOutputStream();
    interface Action { void run() throws Exception; }
    static void check(boolean ok,String message){if(!ok)throw new AssertionError(message);}
    static String className(String v){return switch(v){case "bottle"->"SaltBottle";case "photo"->"PhotoTicket";case "light"->"CheerLight";case "counter"->"CheerCounter";case "echo"->"EchoStage";case "sound"->"SoundBoard";case "planner"->"BoxPlanner";case "station"->"CheerStation";default->throw new IllegalArgumentException("题库无效");};}
    static String stockName(){return switch(variant){case "bottle"->"towels";case "photo"->"paper";case "sound"->"confetti";case "station"->"tickets";default->null;};}
    static int stockStart(){return switch(variant){case "bottle","sound"->3;case "photo"->5;case "station"->4;default->0;};}
    static Field field(String name)throws Exception{Field f=cls.getDeclaredField(name);f.setAccessible(true);return f;}
    static int n(Object o,String name)throws Exception{return field(name).getInt(o);}
    static boolean b(Object o,String name)throws Exception{return field(name).getBoolean(o);}
    static void set(Object o,String name,Object value)throws Exception{field(name).set(o,value);}
    static int stock()throws Exception{return n(null,stockName());}
    static void reset()throws Exception{if(stockName()!=null)set(null,stockName(),stockStart());}
    static Class<?>[] ints(int count){Class<?>[] types=new Class<?>[count];Arrays.fill(types,int.class);return types;}
    static Object make(int... values)throws Exception{Constructor<?> c=cls.getDeclaredConstructor(ints(values.length));c.setAccessible(true);Object[] args=Arrays.stream(values).boxed().toArray();return c.newInstance(args);}
    static Object call(Object o,String name,int... values)throws Exception{Method m=cls.getDeclaredMethod(name,ints(values.length));m.setAccessible(true);return m.invoke(o,Arrays.stream(values).boxed().toArray());}
    static String capture(Action action)throws Exception{stdout.reset();stderr.reset();action.run();check(stderr.size()==0,"作答方法不得额外输出标准错误");return stdout.toString(StandardCharsets.UTF_8).replace("\r\n","\n");}
    static void silent(Action action)throws Exception{check(capture(action).isEmpty(),"题目要求静默的方法不得输出任何内容");}
    static String state(Object o)throws Exception{return switch(variant){
        case "bottle"->n(o,"fizz")+" "+stock();case "photo"->n(o,"poses")+" "+stock();
        case "light"->n(o,"count")+" "+b(o,"running");case "counter"->n(o,"score")+" "+n(o,"played");
        case "echo"->n(o,"shown")+" "+b(o,"active");case "sound"->n(o,"energy")+" "+stock();
        case "planner"->n(o,"need")+" "+n(o,"perBox");case "station"->n(o,"energy")+" "+b(o,"on")+" "+stock();default->"";};}
    static void show(Object o,String expected)throws Exception{String before=state(o);check(capture(()->call(o,"show")).equals(expected+"\n"),"show须输出真实状态，单空格分隔，且只换行一次");check(state(o).equals(before),"show不能修改对象或共享状态");}
    static void fieldContract(String name,Class<?> type,boolean shared)throws Exception{Field f=field(name);check(f.getType()==type&&Modifier.isPrivate(f.getModifiers())&&Modifier.isStatic(f.getModifiers())==shared,"字段 "+name+" 的类型、private或static声明不符合题面");}
    static void method(String name,Class<?> result,int count)throws Exception{Method m=cls.getDeclaredMethod(name,ints(count));check(m.getReturnType()==result&&Modifier.isPublic(m.getModifiers())&&!Modifier.isStatic(m.getModifiers()),"方法 "+name+" 的public实例接口不正确");}
    static void constructor(int count)throws Exception{check(Modifier.isPublic(cls.getDeclaredConstructor(ints(count)).getModifiers()),"题面列出的构造方法须为public");}
    static ClassTree tree(String source)throws Exception{CompilationUnitTree u=SodaHarness.parse(Files.readString(Path.of(source)),new JavacTask[1]);for(Tree t:u.getTypeDecls())if(t instanceof ClassTree c&&c.getSimpleName().contentEquals(className(variant)))return c;throw new AssertionError("缺少作答类");}
    static MethodTree methodTree(String source,String name,int params)throws Exception{for(Tree t:tree(source).getMembers())if(t instanceof MethodTree m&&m.getName().contentEquals(name)&&m.getParameters().size()==params)return m;throw new AssertionError("缺少指定方法");}
    static void chain(String source,int value)throws Exception{MethodTree m=methodTree(source,"<init>",0);check(m.getBody()!=null&&!m.getBody().getStatements().isEmpty()&&m.getBody().getStatements().get(0).toString().replaceAll("\\s+","").equals("this("+value+");"),"无参构造第一句须按题面使用this("+value+")");}
    static void fallThrough(String source,String name)throws Exception{
        boolean[] found={false};new TreeScanner<Void,Void>(){
            public Void visitSwitch(SwitchTree s,Void unused){List<? extends CaseTree> cs=s.getCases();for(int i=0;i+1<cs.size();i++){
                CaseTree a=cs.get(i),next=cs.get(i+1);
                if(a.getExpressions().size()==1&&a.getExpressions().get(0).toString().equals("1")&&next.getExpressions().size()==1&&next.getExpressions().get(0).toString().equals("2")&&a.getStatements()!=null&&!a.getStatements().isEmpty()&&a.getStatements().stream().noneMatch(t->t.getKind()==Tree.Kind.BREAK))found[0]=true;
            }return super.visitSwitch(s,unused);}
        }.scan(methodTree(source,name,1).getBody(),null);check(found[0],"须使用switch，并保留case 1到case 2的指定穿透");
    }
    static void postfix(String source)throws Exception{boolean[] found={false};new TreeScanner<Void,Void>(){public Void visitUnary(UnaryTree u,Void x){if(u.getKind()==Tree.Kind.POSTFIX_INCREMENT)found[0]=true;return super.visitUnary(u,x);}}.scan(methodTree(source,"run",1).getBody(),null);check(found[0],"run须实际使用后置自增");}
    static void schema()throws Exception{
        check(!cls.isInterface(),"请实现题面要求的类");method("show",void.class,0);
        if(stockName()!=null){fieldContract(stockName(),int.class,true);check(initialStock==stockStart(),"共享库存初始值不正确");}
        switch(variant){
            case "bottle":fieldContract("fizz",int.class,false);constructor(1);method("shake",void.class,1);method("calm",void.class,0);break;
            case "photo":fieldContract("poses",int.class,false);constructor(0);constructor(1);method("pose",void.class,1);method("printPhoto",void.class,0);break;
            case "light":fieldContract("count",int.class,false);fieldContract("running",boolean.class,false);for(String m:new String[]{"init","start","loop","stop"})method(m,void.class,0);break;
            case "counter":fieldContract("score",int.class,false);fieldContract("played",int.class,false);method("play",void.class,1);break;
            case "echo":fieldContract("shown",int.class,false);fieldContract("active",boolean.class,false);method("run",void.class,1);method("start",void.class,0);method("stop",void.class,0);break;
            case "sound":fieldContract("energy",int.class,false);method("tap",void.class,1);method("perform",void.class,0);break;
            case "planner":fieldContract("need",int.class,false);fieldContract("perBox",int.class,false);constructor(2);method("add",void.class,1);method("boxes",int.class,0);method("empty",int.class,0);break;
            case "station":fieldContract("energy",int.class,false);fieldContract("on",boolean.class,false);constructor(0);constructor(1);for(String m:new String[]{"start","stop"})method(m,void.class,0);for(String m:new String[]{"chant","rest"})method(m,void.class,1);break;
        }
    }
    static void bottle(int part)throws Exception{
        switch(part){
            case 0:schema();for(int i=0;i<=12;i++){reset();Object a=make(i),z=make(12-i);check(n(a,"fizz")==i&&n(z,"fizz")==12-i,"构造参数须保存在各自独立的fizz字段");}break;
            case 1:for(int i=0;i<=12;i++)for(int p=0;p<=20;p++){reset();Object a=make(i),z=make(2);call(a,"shake",p);check(n(a,"fizz")==Math.min(12,i+p)&&n(z,"fizz")==2&&stock()==3,"shake累加、上限或独立状态错误");}break;
            case 2:for(int i=0;i<=12;i++)for(int s=0;s<=3;s++){reset();Object a=make(i);set(null,"towels",s);call(a,"calm");check(stock()==(i>0&&s>0?s-1:s),"仅在有泡且有毛巾时消耗一条毛巾");if(i==0||s==0)check(n(a,"fizz")==i,"失败操作不能改变泡泡值");}break;
            case 3:for(int i=1;i<=12;i++){reset();Object a=make(i);call(a,"calm");check(n(a,"fizz")==Math.max(0,i-4)&&stock()==2,"每次平静减少4，最低为0");}break;
            case 4:reset();Object a=make(12);call(a,"calm");Object z=make(5);check(stock()==2,"新建对象不能重置共享毛巾");call(a,"calm");call(a,"calm");call(z,"calm");check(stock()==0&&n(a,"fizz")==0&&n(z,"fizz")==5,"毛巾耗尽后所有对象都不能继续平静");break;
            case 5:reset();silent(()->{Object x=make(5);call(x,"shake",0);call(x,"calm");});for(int i=0;i<=12;i++)for(int s=0;s<=3;s++){Object x=make(i);set(x,"fizz",i);set(null,"towels",s);show(x,i+" "+s);}break;
        }
    }
    static void photo(int part,String source)throws Exception{
        switch(part){
            case 0:schema();break;
            case 1:reset();Object d=make();check(n(d,"poses")==2,"无参构造初值须为2");for(int i=0;i<=4;i++){reset();Object a=make(i),z=make(4-i);check(n(a,"poses")==i&&n(z,"poses")==4-i,"构造须使用参数保存实例状态");}break;
            case 2:for(int i=0;i<=4;i++)for(int n=0;n<=10;n++){reset();Object a=make(i);call(a,"pose",n);check(n(a,"poses")==Math.min(4,i+n)&&stock()==5,"pose上限、零增量或库存变化错误");}break;
            case 3:for(int i=0;i<=4;i++)for(int s=0;s<=5;s++){reset();Object a=make(i);set(null,"paper",s);call(a,"printPhoto");boolean ok=i>0&&s>0;check(n(a,"poses")==i-(ok?1:0)&&stock()==s-(ok?1:0),"仅在造型和相纸都足够时各扣1，失败不能改变状态");}break;
            case 4:{reset();Object a=make(4),z=make(2);call(a,"printPhoto");Object c=make(2);check(stock()==4&&n(z,"poses")==2,"对象状态独立，新建不能补相纸");for(int i=0;i<3;i++)call(a,"printPhoto");call(z,"printPhoto");call(c,"printPhoto");check(stock()==0&&n(a,"poses")==0&&n(z,"poses")==1&&n(c,"poses")==2,"所有对象须共用有限相纸");break;}
            case 5:reset();silent(()->{Object a=make();call(a,"pose",1);call(a,"printPhoto");});for(int i=0;i<=4;i++)for(int s=0;s<=5;s++){Object a=make(i);set(a,"poses",i);set(null,"paper",s);show(a,i+" "+s);}break;
        }
    }
    static void light(int part)throws Exception{
        switch(part){
            case 0:schema();Object initial=make();check(n(initial,"count")==10&&!b(initial,"running"),"初始字段须为count=10和running=false");break;
            case 1:for(int v:new int[]{0,2,10,30}){Object a=make();set(a,"count",v);set(a,"running",true);call(a,"init");check(n(a,"count")==0&&!b(a,"running"),"init须修改真实字段，并重置运行状态");}break;
            case 2:Object a=make();call(a,"init");call(a,"start");check(b(a,"running")&&n(a,"count")==0,"start只能开启状态");call(a,"stop");check(!b(a,"running")&&n(a,"count")==0,"stop不能重置计数");check(capture(()->call(a,"loop")).isEmpty()&&n(a,"count")==0,"停止后loop不得输出或改变计数");call(a,"start");call(a,"loop");call(a,"stop");check(n(a,"count")==2&&!b(a,"running"),"重启与停止须读取真实字段");break;
            case 3:for(int v=0;v<=12;v++){Object x=make();set(x,"count",v);set(x,"running",true);String out=capture(()->{call(x,"loop");call(x,"loop");});check(out.equals(v+"\n"+(v+2)+"\n")&&n(x,"count")==v+4,"loop须先输出当前值再加2，连续调用要累积");}break;
            case 4:silent(()->{Object x=make();call(x,"init");call(x,"start");call(x,"stop");});for(int v:new int[]{0,2,10,100})for(boolean run:new boolean[]{false,true}){Object x=make();set(x,"count",v);set(x,"running",run);show(x,v+" "+run);}break;
        }
    }
    static int counterScore(int rounds){int sum=0;for(int i=1;i<=rounds;i++)sum+=i%3==1?3:i%3==2?2:4;return sum;}
    static void counter(int part,String source)throws Exception{
        switch(part){
            case 0:schema();Object zero=make();check(n(zero,"score")==0&&n(zero,"played")==0,"初始分数和轮次应为0");break;
            case 1:for(int first=0;first<=10;first++)for(int second=0;second<=10;second++){Object a=make();call(a,"play",first);call(a,"play",second);check(n(a,"played")==first+second&&n(a,"score")==counterScore(first+second),"多次play必须延续轮次；play(0)不能改变状态");}break;
            case 2:for(int played=0;played<9;played++){Object a=make();set(a,"score",10);set(a,"played",played);call(a,"play",1);int delta=(played+1)%3==1?3:(played+1)%3==2?2:4;check(n(a,"score")==10+delta&&n(a,"played")==played+1,"switch各入口的增量不符合题面");}break;
            case 3:for(int played=0;played<=12;played++)for(int score=0;score<=20;score++){Object a=make();set(a,"played",played);set(a,"score",score);String expected=score+" "+played+" "+(played==0?0.0:(double)score/played);show(a,expected);}break;
            case 4:silent(()->{Object a=make();call(a,"play",5);});Object a=make();call(a,"play",2);show(a,"5 2 2.5");Object z=make();show(z,"0 0 0.0");show(a,"5 2 2.5");break;
        }
    }
    static void echo(int part,String source)throws Exception{
        switch(part){
            case 0:schema();Object zero=make();check(n(zero,"shown")==0&&!b(zero,"active"),"初始shown为0，active为false");break;
            case 1:Object a=make();check(capture(()->call(a,"run",3)).isEmpty()&&n(a,"shown")==0,"未开启时不能运行");call(a,"start");check(b(a,"active"),"start须开启");call(a,"run",1);call(a,"stop");check(!b(a,"active"),"stop须停止");check(capture(()->call(a,"run",3)).isEmpty()&&n(a,"shown")==2,"暂停时不能输出或增加shown");break;
            case 2:for(int v=0;v<=12;v++){Object x=make();set(x,"shown",v);set(x,"active",true);check(capture(()->call(x,"run",1)).equals(v+"\n")&&n(x,"shown")==v+2,"必须输出旧值，再自增并加局部轮次");}break;
            case 3:for(int one=0;one<=5;one++)for(int two=0;two<=5;two++){Object x=make();call(x,"start");StringBuilder exp=new StringBuilder();int shown=0;for(int count:new int[]{one,two})for(int i=1;i<=count;i++){exp.append(shown).append('\n');shown+=1+i;}final int first=one,second=two;String actual=capture(()->{call(x,"run",first);call(x,"run",second);});check(actual.equals(exp.toString())&&n(x,"shown")==shown,"每次调用i重新从1开始，但shown延续");}break;
            case 4:silent(()->{Object x=make();call(x,"start");call(x,"run",0);call(x,"stop");});for(int v:new int[]{0,2,9,25})for(boolean active:new boolean[]{false,true}){Object x=make();set(x,"shown",v);set(x,"active",active);call(x,"run",0);check(n(x,"shown")==v&&b(x,"active")==active,"零轮不能改状态");show(x,v+" "+active);}break;
        }
    }
    static void sound(int part,String source)throws Exception{
        switch(part){
            case 0:schema();reset();check(n(make(),"energy")==0,"初始energy须为0");break;
            case 1:for(int v=0;v<=9;v++)for(int mode=0;mode<=2;mode++){reset();Object a=make();set(a,"energy",v);call(a,"tap",mode);check(n(a,"energy")==Math.min(9,v+(mode==1?5:mode==2?3:1))&&stock()==3,"tap各入口和穿透增量错误");}break;
            case 2:for(int mode:new int[]{-1,3,7,Integer.MIN_VALUE,Integer.MAX_VALUE}){reset();Object a=make();set(a,"energy",8);call(a,"tap",mode);check(n(a,"energy")==8&&stock()==3,"其他mode不得修改状态");}reset();Object cap=make();for(int i=0;i<4;i++)call(cap,"tap",1);check(n(cap,"energy")==9,"多次tap须保持上限9");break;
            case 3:for(int e=0;e<=9;e++)for(int s=0;s<=3;s++){reset();Object a=make();set(a,"energy",e);set(null,"confetti",s);call(a,"perform");boolean ok=e>=4&&s>0;check(n(a,"energy")==e-(ok?4:0)&&stock()==s-(ok?1:0),"表演须同时满足体力和库存条件，失败都不变");}break;
            case 4:{reset();Object a=make(),z=make();call(a,"tap",1);call(a,"perform");Object c=make();check(stock()==2&&n(z,"energy")==0,"新对象不能补礼花，体力须独立");for(int i=0;i<2;i++){call(a,"tap",1);call(a,"perform");}call(a,"tap",1);call(a,"perform");check(stock()==0&&n(a,"energy")==8&&n(c,"energy")==0,"礼花耗尽后不再消费体力");break;}
            case 5:reset();silent(()->{Object a=make();call(a,"tap",1);call(a,"perform");});for(int e=0;e<=9;e++)for(int s=0;s<=3;s++){Object a=make();set(a,"energy",e);set(null,"confetti",s);show(a,e+" "+s);}break;
        }
    }
    static void planner(int part)throws Exception{
        switch(part){
            case 0:schema();for(int n:new int[]{0,1,17,1000})for(int c:new int[]{1,5,50}){Object a=make(n,c);check(n(a,"need")==n&&n(a,"perBox")==c,"构造须分别保存need和perBox");}break;
            case 1:for(int n=0;n<=1000;n++)for(int c=1;c<=50;c++){Object a=make(n,c);check((int)call(a,"boxes")==n/c+(n%c==0?0:1),"boxes必须适用于完整声明范围，检查整除与余数分支");}break;
            case 2:for(int c=1;c<=50;c++)for(int n:new int[]{0,c,2*c,c-1}){Object a=make(n,c);check((int)call(a,"boxes")==n/c+(n%c==0?0:1),"零件数为0返回0，整除不能多加箱");}break;
            case 3:for(int n=0;n<=1000;n++)for(int c=1;c<=50;c++){Object a=make(n,c);int total=n/c+(n%c==0?0:1);check((int)call(a,"empty")==total*c-n,"空位数应为最少箱数乘容量再减need");}break;
            case 4:for(int n=0;n<=20;n++)for(int c=1;c<=10;c++){Object a=make(n,c),z=make(8,3);call(a,"add",5);call(a,"boxes");call(a,"empty");call(a,"add",0);check(n(a,"need")==n+5&&n(a,"perBox")==c&&n(z,"need")==8&&n(z,"perBox")==3,"add只修改本对象need，查询不能改状态");}break;
            case 5:silent(()->{Object a=make(17,5);call(a,"add",1);call(a,"boxes");call(a,"empty");});for(int n:new int[]{0,1,17,20,1000})for(int c:new int[]{1,5,9,50}){Object a=make(n,c);int total=n/c+(n%c==0?0:1);show(a,n+" "+total+" "+(total*c-n));}break;
        }
    }
    static void station(int part,String source)throws Exception{
        switch(part){
            case 0:schema();reset();Object d=make();check(n(d,"energy")==3&&!b(d,"on"),"无参初值应为3且未开启");for(int e=0;e<=8;e++){reset();Object a=make(e);check(n(a,"energy")==e&&!b(a,"on"),"有参构造保存体力并初始关闭");}break;
            case 1:{reset();Object a=make(),z=make(5);call(a,"start");call(a,"chant",2);check(n(a,"energy")==1&&n(z,"energy")==5&&stock()==2,"体力独立、券数共享");Object c=make(2);check(stock()==2,"新对象不能刷券");call(z,"start");call(z,"chant",3);call(a,"chant",1);check(n(z,"energy")==3&&!b(z,"on")&&n(a,"energy")==1&&!b(a,"on")&&stock()==0,"共享券耗尽后须停止且不再消耗");call(c,"start");check(!b(c,"on"),"无券不能开启");break;}
            case 2:for(int e:new int[]{0,1,8})for(int s:new int[]{0,1,4}){reset();Object a=make(e);set(null,"tickets",s);call(a,"start");check(b(a,"on")== (e>0&&s>0),"启动必须同时有体力和券");call(a,"stop");call(a,"rest",2);check(!b(a,"on")&&n(a,"energy")==Math.min(8,e+2)&&stock()==s,"stop不消耗资源，rest不能自动开启");}break;
            case 3:for(int e=0;e<=8;e++)for(int s=0;s<=4;s++)for(boolean on:new boolean[]{false,true})for(int rounds=0;rounds<=20;rounds++){reset();Object a=make(e);set(a,"on",on);set(null,"tickets",s);call(a,"chant",rounds);int used=on?Math.min(rounds,Math.min(e,s)):0;boolean next=rounds==0?on:on&&e-used>0&&s-used>0;check(n(a,"energy")==e-used&&stock()==s-used&&b(a,"on")==next,"逐轮各消耗1，资源耗尽须立即关闭，失败不消费");}break;
            case 4:for(int e=0;e<=8;e++)for(int gain=0;gain<=20;gain++){reset();Object a=make(e);set(a,"on",true);call(a,"rest",gain);call(a,"chant",0);check(n(a,"energy")==Math.min(8,e+gain)&&b(a,"on")&&stock()==4,"恢复上限8，零轮不能改开关或库存");}break;
            case 5:reset();silent(()->{Object a=make();call(a,"start");call(a,"chant",1);call(a,"rest",2);call(a,"stop");});for(int e:new int[]{0,1,8})for(int s=0;s<=4;s++)for(boolean on:new boolean[]{false,true}){Object a=make(e);set(a,"energy",e);set(a,"on",on);set(null,"tickets",s);show(a,e+" "+on+" "+s);}break;
        }
    }
    public static void main(String[] args)throws Exception{
        System.setOut(new PrintStream(stdout,true,StandardCharsets.UTF_8));System.setErr(new PrintStream(stderr,true,StandardCharsets.UTF_8));String result;
        try{
            if(args[0].equals("main-contract")){check(SodaHarness.mainTree(Files.readString(Path.of(args[2]))).equals(SodaHarness.mainTree(Files.readString(Path.of(args[3])))),"Main主程序不可修改");}
            else if(args[0].startsWith("syntax-")){
                // This mode is launched with trusted classes ONLY: parse as data,
                // never compile or load any student class without a sandbox.
                variant=args[4];
                switch(variant){case "photo":chain(args[2],2);break;case "station":chain(args[2],3);break;case "counter":fallThrough(args[2],"play");break;case "sound":fallThrough(args[2],"tap");break;case "echo":postfix(args[2]);break;default:throw new AssertionError("无语法评分项");}
            }else{
                variant=args[4];cls=Class.forName(className(variant));initialStock=stockName()==null?0:stock();
                int part=Integer.parseInt(args[0].substring(4));
                switch(variant){case "bottle":bottle(part);break;case "photo":photo(part,args[2]);break;case "light":light(part);break;case "counter":counter(part,args[2]);break;case "echo":echo(part,args[2]);break;case "sound":sound(part,args[2]);break;case "planner":planner(part);break;case "station":station(part,args[2]);break;default:throw new AssertionError("未知题库");}
            }
            result="AC|本评分项通过：结构与真实对象状态符合题面";
        }catch(Throwable e){while(e instanceof InvocationTargetException&&e.getCause()!=null)e=e.getCause();result=(e instanceof AssertionError?"WA|":"RE|")+(e.getMessage()==null?e.getClass().getSimpleName():e.getMessage());}
        Files.writeString(Path.of(args[1]),result);
    }
}
