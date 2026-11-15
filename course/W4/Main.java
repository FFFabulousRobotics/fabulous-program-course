class Soda {
    private int hp;
    private static int potions = 2;

    public Soda(int hp) {
        // 补全构造方法
    }
    public void hurt(int damage) {
        // 补全扣血逻辑
    }
    public void heal() {
        // 补全治疗逻辑
    }
    public void show() {
        // 补全输出逻辑
    }
}

public class Main {
    public static void main(String[] args) {
        Soda host = new Soda(10);
        Soda roommate = new Soda(8);

        host.heal();
        host.hurt(12);
        host.heal();
        host.show();

        roommate.heal();
        roommate.show();

        roommate.hurt(4);
        roommate.heal();
        roommate.show();

        roommate.hurt(2);
        roommate.heal();
        roommate.show();

        host.show();
    }
}
