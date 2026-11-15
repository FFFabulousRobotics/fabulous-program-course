class Soda {
    private int hp;
    private static int potions = 2;

    public Soda(int hp) {
        this.hp = hp;
    }
    public void hurt(int damage) {
        hp -= damage;
        if (hp < 0) hp = 0;
    }
    public void heal() {
        if (hp > 0 && hp < 10 && potions > 0) {
            potions--;
            hp += 3;
            if (hp > 10) hp = 10;
        }
    }
    public void show() {
        System.out.println(hp + " " + potions);
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
