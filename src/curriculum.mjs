import {flowerPrompt,flowerExplanation,flowerRule} from './w1-flower-correction.mjs';
const java = text => '```java\n' + text + '\n```';
const q = (id, prompt, accepts, hint = '') => ({ id, prompt, accepts, hint });
const opImports = `import com.qualcomm.robotcore.eventloop.opmode.TeleOp;\nimport com.qualcomm.robotcore.eventloop.opmode.LinearOpMode;`;
export const curriculumVersion = 2;
export const lessons = [
  {
    id: 'w1-01', code: 'W1.1', order: 1, title: 'BIOBUZZ：读懂比赛与场地', subtitle: '任务、分值与自动 / 手动阶段', estimate: '10 分钟', published: true,
    content: `# W1 的起点：先知道机器人要做什么

本周课程来自《W1教案》，面向 FFFabulous Robotics · FTC 19726 编程组。整节课约 40 分钟，网站将它拆成四篇，课后可以继续练习。

## 观看赛季动画

[打开教案中的 BIOBUZZ 赛季介绍视频](https://www.bilibili.com/video/BV1oDYo6gEcM/)

观看时先回答：机器人操作什么物件？从哪里取得物件？最后要把物件送到哪里？不要急着记所有术语。

## 三类任务

以下分值沿用你们的 W1 教案，用于本课程练习；真实比赛以当季赛事手册及更新为准。

- 蜂巢任务：向蜂巢中投球，使蜂巢翻转，教案记为每次 20 分。
${flowerRule}
- 停泊与离开：教案记为自动阶段 3 分、手动阶段 5 分。

## 读场地，而不只是看图片

![W1教案中的 BIOBUZZ 场地图](/course-assets/image2.png)

在图上找到红蓝联盟区域、花朵、花园和中间的蜂房。图中的箭头标出了预载花粉及各区域的花蜜、花粉数量。试着从自己的联盟区域出发，用手指出一次取物、移动和放置的路线。

## 自动阶段与手动阶段

自动阶段持续 **30 秒**，机器人执行预先编写的程序。手动阶段持续 **120 秒**，程序持续读取驾驶员操作并控制机器人。自动不是“没有程序”，手动也不是“只有遥控器”；两个阶段都需要代码。

教案给出的学年计划为六场比赛：上半学期三场、寒假国赛一场、下半学期一场、暑假 WRC 一场。这是队内课程安排，具体日期由队伍后续通知。

## 把规则变成程序问题

同样是“向目标放球”，程序要依次解决：物件在哪里、机构如何动作、何时停止、如何知道任务完成。后面的 Java 和 OpMode 课程，就是为这些问题建立基础。`,
    fillQuestions: [q('auto','自动阶段持续多少秒？',['30']),q('teleop','手动阶段持续多少秒？',['120']),q('hive','按 W1 教案，蜂巢翻转一次计多少分？',['20']),q('score',flowerPrompt,['46'],flowerExplanation),q('phase','驾驶员在比赛中操控机器人的程序通常标记为 @___。',['TeleOp'],'答案在下一篇代码概览中也会出现。')], codeTask: null
  },
  {
    id:'w1-02', code:'W1.2', order:2, title:'第一个 Java 程序', subtitle:'class、main 与 println', estimate:'10 分钟', published:true,
    content: `# 从 Hello World 认识三个结构

本篇先掌握三件事：类是容器、main 是入口、println 输出一行文字。变量、类型和常量留到下一周深入学习。

${java(`public class Hello {\n    public static void main(String[] args) {\n        System.out.println("Hello, FTC 19726!");\n    }\n}`)}

## class：给代码一个容器

class 声明一个类，这里的类名是 Hello。保存为 **Hello.java**；公开顶层类的名字必须与文件名一致，连大小写也要对应。大括号标出类和方法的边界。

本网站会根据你的公开类名建立同名 Java 文件，因此既可以用 Hello，也可以用 Main。不要把类放到包里，本周先统一练习默认包。

## main：独立 Java 程序的入口

${java('public static void main(String[] args) {\n    // 从这里开始执行独立控制台程序\n}')}

- public 是访问修饰符，表示这个方法可以从类外访问。
- static 表示方法属于类，不需要先创建 Hello 对象。
- void 是返回类型，表示方法不返回值；它不是访问修饰符。
- main 是方法名；String[] args 是接收命令行参数的字符串数组。

本周先能识别这行代码。并不是所有 Java 代码都要自己写 main：稍后 FTC SDK 会替我们管理启动入口。

## println：输出并换行

${java('System.out.println("Hello, FTC 19726!");\nSystem.out.println("Ready for BIOBUZZ.");')}

引号里的内容会原样输出。每个 println 在末尾换行。分号结束一条语句。英文字母大小写、空格和标点都可能影响答案。

## 命名与修改练习

类名习惯使用大驼峰，比如 HelloRobot；变量名习惯使用小驼峰，比如 teamNumber。名字不能以数字开头，不能使用 class 等关键字。

先运行原程序，然后把问候改成自己的名字。最后完成课后练习：输出两行队伍信息。编译报错时先找错误的行号，检查分号、引号和括号。

## 下一步：在真实项目里找位置

FTC 项目的 TeamCode 目录用于队伍自己的代码；FtcRobotController 是机器人控制器应用部分。本课下一篇展示可直接对官方 SDK 编译的最小程序。`,
    fillQuestions:[q('class','声明类使用哪个关键字？',['class']),q('main','独立 Java 控制台程序的标准入口方法名是什么？',['main']),q('file','public class Hello 对应的文件名是什么？',['Hello.java']),q('return','main 不返回值，使用哪个返回类型？',['void'])],
    codeTask:{kind:'java', title:'FP102 · 向 19726 报到', description:'编写一个独立 Java 程序，严格输出下列两行。允许任意合法 Java 实现，不要求使用固定变量名。', input:'无输入', output:'两行文字，区分大小写、空格及标点。', sampleOutput:'Hello, FTC 19726!\nReady for BIOBUZZ.',starter:'public class Hello {\n    public static void main(String[] args) {\n        // 输出两行队伍信息\n    }\n}', tests:[{name:'队伍问候与备赛信息',expected:'Hello, FTC 19726!\nReady for BIOBUZZ.'}]}
  },
  {
    id:'w1-03',code:'W1.3',order:3,title:'机器人程序：LinearOpMode',subtitle:'注解、继承、等待开始与主循环',estimate:'12 分钟',published:true,
    content:`# 机器人代码里，main 去哪里了？

FTC 机器人程序运行在 Robot Controller 的 Android 应用中。应用和 SDK 负责启动、发现程序并调用生命周期方法。我们实现 runOpMode，通常不在自己的 OpMode 类中写 main。

## 先看完整的最小骨架

${java(`${opImports}\n\n@TeleOp(name = "MyFirstOp")\npublic class MyFirstOp extends LinearOpMode {\n    @Override\n    public void runOpMode() throws InterruptedException {\n        waitForStart();\n        while (opModeIsActive()) {\n            telemetry.addData("Status", "Running");\n            telemetry.update();\n        }\n    }\n}`)}

import 告诉编译器从哪里找到类。这些类来自 FTC 官方 SDK。本网站已挂载官方 SDK，在提交时会真实检查类、方法、参数和返回类型。

## @TeleOp：让程序出现在手控列表

@TeleOp 是注解，name 设置 Driver Station 列表中的显示名。改用 @Autonomous 则标记自动程序。注解不等于程序已经开始运行，仍需要经历初始化和开始阶段。

## extends 与 @Override

extends LinearOpMode 表示继承官方基类。@Override 告诉编译器：下面的方法重写父类中的方法；方法名拼错时编译器可以提醒你。继承的完整语法会在后续课学习。

## 先准备，再开始，最后停止

- INIT 后执行 runOpMode 中 waitForStart 之前的初始化。
- waitForStart 等待驾驶员按下 START，不能把等待删掉后就开始驱动机构。
- while (opModeIsActive()) 在开始后循环，在停止请求到来后退出。

停止也可能发生在开始之前。等待返回后先检查 isStopRequested，是一个有用的防护：

${java('waitForStart();\nif (isStopRequested()) return;\nwhile (opModeIsActive()) {\n    telemetry.addData("Status", "Running");\n    telemetry.update();\n}')}

## telemetry：先看到程序的状态

addData 用键和值准备一条消息，update 发送当前消息。本课用 Status=Ready 和 Status=Running 验证程序何时在准备、何时在运行。

运行代码时会打开 Beta8397 二维仿真：点击 INIT 初始化、START 开始、STOP 停止，观察实时 telemetry。提交评测时由系统自动检查这些行为。代码先经过官方 FTC SDK 编译检查，再运行在 Beta8397 的兼容 SDK 与虚拟硬件中；这不是 Android Control Hub，也不代表已通过真机验收。`,
    fillQuestions:[q('annotation','把程序放入手控列表的注解名称是什么？',['TeleOp','@TeleOp']),q('entry','LinearOpMode 中需要重写的方法叫什么？',['runOpMode']),q('wait','等待开始的方法叫什么（不含括号）？',['waitForStart']),q('active','开始后且未停止时为 true 的方法叫什么？',['opModeIsActive'])],
    codeTask:{kind:'linear',title:'FP103 · 从 Ready 到 Running',description:'创建 @TeleOp(name = "MyFirstOp") 的 LinearOpMode。等待开始前发送一次 Status=Ready；等待 START；开始后在活动循环中反复发送 Status=Running。收到 STOP 后及时退出。不要在 START 前发送 Running。',input:'测试驱动自动发送 START / STOP；另测初始化阶段取消。',output:'telemetry 的键为 Status，值为 Ready 或 Running；每次 addData 后调用 update。',sampleOutput:'INIT  → Status = Ready\nSTART → Status = Running（重复）\nSTOP  → 程序退出',starter:`${opImports}\n\n@TeleOp(name = "MyFirstOp")\npublic class MyFirstOp extends LinearOpMode {\n    @Override\n    public void runOpMode() throws InterruptedException {\n        // 发送 Ready\n        // 等待开始\n        // 活动期间持续发送 Running\n    }\n}`,tests:[{name:'INIT → START → STOP',scenario:'linear'},{name:'INIT 阶段取消',scenario:'cancel'}]}
  },
  {
    id:'w1-04',code:'W1.4',order:4,title:'迭代式 OpMode 与课后挑战',subtitle:'init、loop、stop 与两种控制流程',estimate:'8 分钟 + 练习',published:true,
    content:`# 当 SDK 来调用你的代码

LinearOpMode 由你写顺序控制流；迭代式 OpMode 则由 SDK 在不同阶段调用不同方法。它们都可以实现手控或自动功能，但组织代码的方式不同。

${java('import com.qualcomm.robotcore.eventloop.opmode.TeleOp;\nimport com.qualcomm.robotcore.eventloop.opmode.OpMode;\n\n@TeleOp(name = "IterativeDemo")\npublic class IterativeDemo extends OpMode {\n    @Override\n    public void init() {\n        telemetry.addData("Status", "Ready");\n        telemetry.update();\n    }\n\n    @Override\n    public void loop() {\n        telemetry.addData("Status", "Running");\n        telemetry.update();\n    }\n\n    @Override\n    public void stop() {\n        telemetry.addData("Status", "Stopped");\n        telemetry.update();\n    }\n}')}

## 生命周期顺序

INIT 时调用 init 一次；等待开始期间可以反复调用 init_loop；START 时调用 start 一次；运行期间反复调用 loop；STOP 时调用 stop。init 与 loop 是需要实现的抽象方法，其他方法按需要重写。

## loop 里面不用再写无限循环

每次 loop 处理当前这一轮工作，然后尽快返回，由 SDK 安排下一次调用。若写 while(true)，SDK 的后续阶段就可能被阻塞。没有“每轮严格固定多少毫秒”的保证，不要把循环次数当成精确时间。

## 对照上一种写法

- LinearOpMode：入口 runOpMode，自己调用 waitForStart，自己写活动循环。
- OpMode：实现 init 和 loop，由 SDK 安排何时调用；停止清理可以写在 stop。
- 两种写法都能使用 @TeleOp / @Autonomous 和 telemetry。

## 课后扩充

先完成状态报告员练习。评测会分别调用 1、3、7 次 loop，检查 Ready 只在初始化出现、Running 每轮出现、Stopped 在结束时出现。这样可以发现只输出固定答案、把初始化放进循环或忘记更新 telemetry 的问题。

完成后尝试自学挑战：用一个整数统计 loop 次数并输出到 telemetry。它不计入本周成绩；下一周将正式学习变量、类型和常量。

## 本周结束检查

你应当能够独立运行 Hello World，指出类名和入口，解释机器人程序为什么不写 main，并能识别两种 OpMode 骨架。代码能编译只是第一步；真机测试仍要检查硬件配置、启动和停止行为。`,
    fillQuestions:[q('init','迭代式 OpMode 初始化时只执行一次的方法是什么？',['init']),q('loop','运行中由 SDK 反复调用的方法是什么？',['loop']),q('stop','停止阶段的方法是什么？',['stop']),q('inherit','表示继承的 Java 关键字是什么？',['extends'])],
    codeTask:{kind:'iterative',title:'FP104 · 生命周期状态报告员',description:'创建 @TeleOp(name = "IterativeDemo") 的 OpMode。init 发送一次 Status=Ready，loop 每次发送一次 Status=Running，stop 发送一次 Status=Stopped。每次发送都需调用 telemetry.update()。',input:'测试驱动调用 init、start、N 次 loop、stop，N 分别为 1、3、7。',output:'阶段与 telemetry 内容必须匹配，不要写阻塞循环。',sampleOutput:'Status = Ready\nStatus = Running（每次 loop 一条）\nStatus = Stopped',starter:'import com.qualcomm.robotcore.eventloop.opmode.TeleOp;\nimport com.qualcomm.robotcore.eventloop.opmode.OpMode;\n\n@TeleOp(name = "IterativeDemo")\npublic class IterativeDemo extends OpMode {\n    @Override\n    public void init() {\n    }\n\n    @Override\n    public void loop() {\n    }\n\n    @Override\n    public void stop() {\n    }\n}',tests:[{name:'1 次 loop',scenario:'1'},{name:'3 次 loop',scenario:'3'},{name:'7 次 loop',scenario:'7'}]}
  }
];
