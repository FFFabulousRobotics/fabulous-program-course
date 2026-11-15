# 一、知识选择题（共 16 道）

## 第一部分：类、对象、方法

1. 以下关于 Java 中类的说法正确的是（ ）  
   A. 一个 `.java` 文件中可以有多个 `public class`  
   B. 一个 `.java` 文件中只能有一个 `class`  
   C. 一个 `.java` 文件中可以有多个 `class`，但只能有一个 `public class`  
   D. 类就是对象  
   **答案：C**

2. 在 Java 中，成员变量定义在（ ）  
   A. 方法内部  
   B. 类里面、方法外面  
   C. 构造方法内部  
   D. 代码块内部  
   **答案：B**

3. 方法可以理解为（ ）  
   A. 对象的属性  
   B. 类的行为  
   C. 类的状态  
   D. 对象的名称  
   **答案：B**

4. 对象具有（ ）  
   A. 只有状态  
   B. 只有行为  
   C. 状态和行为  
   D. 既无状态也无行为  
   **答案：C**

## 第二部分：构造方法

5. 关于构造方法，以下说法正确的是（ ）  
   A. 构造方法可以有返回值类型  
   B. 构造方法名可以与类名不同  
   C. 构造方法没有返回值，且与类同名  
   D. 不写构造方法时，Java 不会提供默认构造方法  
   **答案：C**

6. 以下关于构造方法的说法错误的是（ ）  
   A. 构造方法与类同名  
   B. 构造方法没有返回值  
   C. 构造方法可以写 `void`  
   D. 不写构造方法时，Java 会提供默认构造方法  
   **答案：C**

7. 构造方法在（ ）时被调用。  
   A. 定义类  
   B. `new` 实例化对象  
   C. 调用普通方法  
   D. 程序结束  
   **答案：B**

8. 构造方法不能有任何（ ）声明，否则会被当作普通方法。  
   A. 参数  
   B. 返回类型  
   C. 访问修饰符  
   D. 方法体  
   **答案：B**

## 第三部分：实例化与 `this` / `new`

9. 以下关于 `this` 的说法正确的是（ ）  
   A. `this` 可以用于在静态方法中引用当前对象  
   B. `this` 可以区分成员变量和局部变量  
   C. `this` 只能用于构造方法  
   D. `this` 是一个变量  
   **答案：B**

10. 使用（ ）关键字可以创建一个对象，并调用构造方法进行初始化。  
    A. `class`  
    B. `new`  
    C. `this`  
    D. `static`  
    **答案：B**

11. 在构造方法中使用 `this()` 调用另一个构造方法时，必须放在（ ）  
    A. 任意位置  
    B. 第一行  
    C. 最后一行  
    D. 不能调用  
    **答案：B**

12. 成员变量定义在类里面、方法外面；局部变量定义在方法内部。当它们同名时，局部变量优先级（ ）  
    A. 更低  
    B. 更高  
    C. 相同  
    D. 无法确定  
    **答案：B**

## 第四部分：流程控制（`if` / `for`）

13. 以下哪个语句用于循环执行一段代码？（ ）  
    A. `if`  
    B. `for`  
    C. `switch`  
    D. `class`  
    **答案：B**

14. `if` 语句用于（ ）  
    A. 循环  
    B. 条件判断  
    C. 定义类  
    D. 创建对象  
    **答案：B**

15. 关于 `for` 循环 `for (int i = 1; i <= 3; i++)`，循环体会执行几次？（ ）  
    A. 1  
    B. 2  
    C. 3  
    D. 4  
    **答案：C**

16. 在流程控制中，最常见的是（ ）  
    A. `if` 和 `for`  
    B. `class` 和 `new`  
    C. `this` 和 `super`  
    D. `public` 和 `private`  
    **答案：A**

---

# 二、读程序选择题（第一、二、三部分各一道）

## 第一部分：类、对象、方法

```java
class Dog {
    String name;
    String breed;
    String color;
    void bark() {
        System.out.println(name + " 汪汪叫");
    }
    void wagTail() {
        System.out.println(name + " 摇尾巴");
    }
}
public class Main {
    public static void main(String[] args) {
        Dog d = new Dog();
        d.name = "旺财";
        d.breed = "中华田园犬";
        d.color = "黄色";
        d.bark();
        d.wagTail();
    }
}
```

**问题**：程序的输出结果是（ ）  
A. 旺财 汪汪叫  
   旺财 摇尾巴  
B. 旺财 摇尾巴  
   旺财 汪汪叫  
C. 汪汪叫 旺财  
   摇尾巴 旺财  
D. 中华田园犬 汪汪叫  
   黄色 摇尾巴  
**答案：A**

## 第二部分：构造方法

```java
class Arm {
    private double grabPosition;
    public Arm() {
        this(0.4);
    }
    public Arm(double initialPosition) {
        this.grabPosition = initialPosition;
    }
    public void show() {
        System.out.println("夹爪 = " + grabPosition);
    }
}
public class Main {
    public static void main(String[] args) {
        Arm a1 = new Arm();
        a1.show();
        Arm a2 = new Arm(0.92);
        a2.show();
    }
}
```

**问题**：程序的输出结果是（ ）  
A. 夹爪 = 0.4  
   夹爪 = 0.92  
B. 夹爪 = 0.92  
   夹爪 = 0.4  
C. 夹爪 = 0.0  
   夹爪 = 0.0  
D. 夹爪 = 0.4  
   夹爪 = 0.4  
**答案：A**

## 第三部分：实例化与 `this` / `new`

```java
class Counter {
    static int count = 0;
    int id;
    public Counter() {
        count++;
        id = count;
    }
    public void show() {
        System.out.println("我是第 " + id + " 个，总数 " + count);
    }
}
public class Main {
    public static void main(String[] args) {
        Counter c1 = new Counter();
        c1.show();
        Counter c2 = new Counter();
        c2.show();
        Counter c3 = new Counter();
        c3.show();
    }
}
```

**问题**：程序的输出结果是（ ）  
A. 我是第 1 个，总数 1  
   我是第 2 个，总数 2  
   我是第 3 个，总数 3  
B. 我是第 1 个，总数 3  
   我是第 2 个，总数 3  
   我是第 3 个，总数 3  
C. 我是第 1 个，总数 1  
   我是第 1 个，总数 2  
   我是第 1 个，总数 3  
D. 我是第 3 个，总数 3  
   我是第 2 个，总数 3  
   我是第 1 个，总数 3  
**答案：A**

---

# 三、补全程序选择题（第一、二、三部分各一道）

## 第一部分：类、对象、方法

```java
class Student {
    String name;
    int age;
    void study() {
        System.out.println(name + " 在学习");
    }
}
public class Main {
    public static void main(String[] args) {
        Student s = new Student();
        s.name = "小明";
        s.age = 18;
        ______; // 调用 study 方法
    }
}
```

**问题**：横线处应填入（ ）  
A. `s.study();`  
B. `study();`  
C. `Student.study();`  
D. `s->study();`  
**答案：A**

## 第二部分：构造方法

```java
class Person {
    String name;
    int age;
    public Person(String name, int age) {
        ______.name = name;
        ______.age = age;
    }
    public void show() {
        System.out.println(name + " " + age);
    }
}
public class Main {
    public static void main(String[] args) {
        Person p = new Person("张三", 20);
        p.show();
    }
}
```

**问题**：横线处应依次填入（ ）  
A. `this`、`this`  
B. `super`、`super`  
C. `Person`、`Person`  
D. `new`、`new`  
**答案：A**

## 第三部分：实例化与 `this` / `new`

```java
class Book {
    String title;
    double price;
    public Book() {
        this("未知", 0.0);
    }
    public Book(String title, double price) {
        ______.title = title;
        ______.price = price;
    }
    public void show() {
        System.out.println(title + " " + price);
    }
}
public class Main {
    public static void main(String[] args) {
        Book b1 = new Book();
        b1.show();
        Book b2 = new Book("Java编程", 59.9);
        b2.show();
    }
}
```

**问题**：横线处应依次填入（ ）  
A. `this`、`this`  
B. `super`、`super`  
C. `Book`、`Book`  
D. `new`、`new`  
**答案：A**

---

以上所有题目均为四选一单选题，可直接用于课堂练习或测试。以下所有题目均为四选一单选题，符合 CSP 初赛风格。共 22 道：知识选择题 16 道（每部分 4 道），读程序选择题 3 道（第一、二、三部分各 1 道），补全程序选择题 3 道（第一、二、三部分各 1 道）。第四部分已有一道读程序题，故不再重复。

---

# 一、知识选择题（共 16 道）

## 第一部分：类、对象、方法

1. 以下关于 Java 中类的说法正确的是（ ）  
   A. 一个 `.java` 文件中可以有多个 `public class`  
   B. 一个 `.java` 文件中只能有一个 `class`  
   C. 一个 `.java` 文件中可以有多个 `class`，但只能有一个 `public class`  
   D. 类就是对象  
   **答案：C**

2. 在 Java 中，成员变量定义在（ ）  
   A. 方法内部  
   B. 类里面、方法外面  
   C. 构造方法内部  
   D. 代码块内部  
   **答案：B**

3. 方法可以理解为（ ）  
   A. 对象的属性  
   B. 类的行为  
   C. 类的状态  
   D. 对象的名称  
   **答案：B**

4. 对象具有（ ）  
   A. 只有状态  
   B. 只有行为  
   C. 状态和行为  
   D. 既无状态也无行为  
   **答案：C**

## 第二部分：构造方法

5. 关于构造方法，以下说法正确的是（ ）  
   A. 构造方法可以有返回值类型  
   B. 构造方法名可以与类名不同  
   C. 构造方法没有返回值，且与类同名  
   D. 不写构造方法时，Java 不会提供默认构造方法  
   **答案：C**

6. 以下关于构造方法的说法错误的是（ ）  
   A. 构造方法与类同名  
   B. 构造方法没有返回值  
   C. 构造方法可以写 `void`  
   D. 不写构造方法时，Java 会提供默认构造方法  
   **答案：C**

7. 构造方法在（ ）时被调用。  
   A. 定义类  
   B. `new` 实例化对象  
   C. 调用普通方法  
   D. 程序结束  
   **答案：B**

8. 构造方法不能有任何（ ）声明，否则会被当作普通方法。  
   A. 参数  
   B. 返回类型  
   C. 访问修饰符  
   D. 方法体  
   **答案：B**

## 第三部分：实例化与 `this` / `new`

9. 以下关于 `this` 的说法正确的是（ ）  
   A. `this` 可以用于在静态方法中引用当前对象  
   B. `this` 可以区分成员变量和局部变量  
   C. `this` 只能用于构造方法  
   D. `this` 是一个变量  
   **答案：B**

10. 使用（ ）关键字可以创建一个对象，并调用构造方法进行初始化。  
    A. `class`  
    B. `new`  
    C. `this`  
    D. `static`  
    **答案：B**

11. 在构造方法中使用 `this()` 调用另一个构造方法时，必须放在（ ）  
    A. 任意位置  
    B. 第一行  
    C. 最后一行  
    D. 不能调用  
    **答案：B**

12. 成员变量定义在类里面、方法外面；局部变量定义在方法内部。当它们同名时，局部变量优先级（ ）  
    A. 更低  
    B. 更高  
    C. 相同  
    D. 无法确定  
    **答案：B**

## 第四部分：流程控制（`if` / `for`）

13. 以下哪个语句用于循环执行一段代码？（ ）  
    A. `if`  
    B. `for`  
    C. `switch`  
    D. `class`  
    **答案：B**

14. `if` 语句用于（ ）  
    A. 循环  
    B. 条件判断  
    C. 定义类  
    D. 创建对象  
    **答案：B**

15. 关于 `for` 循环 `for (int i = 1; i <= 3; i++)`，循环体会执行几次？（ ）  
    A. 1  
    B. 2  
    C. 3  
    D. 4  
    **答案：C**

16. 在流程控制中，最常见的是（ ）  
    A. `if` 和 `for`  
    B. `class` 和 `new`  
    C. `this` 和 `super`  
    D. `public` 和 `private`  
    **答案：A**

---

# 二、读程序选择题（第一、二、三部分各一道）

## 第一部分：类、对象、方法

```java
class Dog {
    String name;
    String breed;
    String color;
    void bark() {
        System.out.println(name + " 汪汪叫");
    }
    void wagTail() {
        System.out.println(name + " 摇尾巴");
    }
}
public class Main {
    public static void main(String[] args) {
        Dog d = new Dog();
        d.name = "旺财";
        d.breed = "中华田园犬";
        d.color = "黄色";
        d.bark();
        d.wagTail();
    }
}
```

**问题**：程序的输出结果是（ ）  
A. 旺财 汪汪叫  
   旺财 摇尾巴  
B. 旺财 摇尾巴  
   旺财 汪汪叫  
C. 汪汪叫 旺财  
   摇尾巴 旺财  
D. 中华田园犬 汪汪叫  
   黄色 摇尾巴  
**答案：A**

## 第二部分：构造方法

```java
class Arm {
    private double grabPosition;
    public Arm() {
        this(0.4);
    }
    public Arm(double initialPosition) {
        this.grabPosition = initialPosition;
    }
    public void show() {
        System.out.println("夹爪 = " + grabPosition);
    }
}
public class Main {
    public static void main(String[] args) {
        Arm a1 = new Arm();
        a1.show();
        Arm a2 = new Arm(0.92);
        a2.show();
    }
}
```

**问题**：程序的输出结果是（ ）  
A. 夹爪 = 0.4  
   夹爪 = 0.92  
B. 夹爪 = 0.92  
   夹爪 = 0.4  
C. 夹爪 = 0.0  
   夹爪 = 0.0  
D. 夹爪 = 0.4  
   夹爪 = 0.4  
**答案：A**

## 第三部分：实例化与 `this` / `new`

```java
class Counter {
    static int count = 0;
    int id;
    public Counter() {
        count++;
        id = count;
    }
    public void show() {
        System.out.println("我是第 " + id + " 个，总数 " + count);
    }
}
public class Main {
    public static void main(String[] args) {
        Counter c1 = new Counter();
        c1.show();
        Counter c2 = new Counter();
        c2.show();
        Counter c3 = new Counter();
        c3.show();
    }
}
```

**问题**：程序的输出结果是（ ）  
A. 我是第 1 个，总数 1  
   我是第 2 个，总数 2  
   我是第 3 个，总数 3  
B. 我是第 1 个，总数 3  
   我是第 2 个，总数 3  
   我是第 3 个，总数 3  
C. 我是第 1 个，总数 1  
   我是第 1 个，总数 2  
   我是第 1 个，总数 3  
D. 我是第 3 个，总数 3  
   我是第 2 个，总数 3  
   我是第 1 个，总数 3  
**答案：A**

---

# 三、补全程序选择题（第一、二、三部分各一道）

## 第一部分：类、对象、方法

```java
class Student {
    String name;
    int age;
    void study() {
        System.out.println(name + " 在学习");
    }
}
public class Main {
    public static void main(String[] args) {
        Student s = new Student();
        s.name = "小明";
        s.age = 18;
        ______; // 调用 study 方法
    }
}
```

**问题**：横线处应填入（ ）  
A. `s.study();`  
B. `study();`  
C. `Student.study();`  
D. `s->study();`  
**答案：A**

## 第二部分：构造方法

```java
class Person {
    String name;
    int age;
    public Person(String name, int age) {
        ______.name = name;
        ______.age = age;
    }
    public void show() {
        System.out.println(name + " " + age);
    }
}
public class Main {
    public static void main(String[] args) {
        Person p = new Person("张三", 20);
        p.show();
    }
}
```

**问题**：横线处应依次填入（ ）  
A. `this`、`this`  
B. `super`、`super`  
C. `Person`、`Person`  
D. `new`、`new`  
**答案：A**

## 第三部分：实例化与 `this` / `new`

```java
class Book {
    String title;
    double price;
    public Book() {
        this("未知", 0.0);
    }
    public Book(String title, double price) {
        ______.title = title;
        ______.price = price;
    }
    public void show() {
        System.out.println(title + " " + price);
    }
}
public class Main {
    public static void main(String[] args) {
        Book b1 = new Book();
        b1.show();
        Book b2 = new Book("Java编程", 59.9);
        b2.show();
    }
}
```

**问题**：横线处应依次填入（ ）  
A. `this`、`this`  
B. `super`、`super`  
C. `Book`、`Book`  
D. `new`、`new`  
**答案：A**

---