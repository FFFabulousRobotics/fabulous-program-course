import java.util.Scanner;

class traveller {
    String name;
    int sex;
    char property;
    int height, charm;

    public traveller(String name, int sex, char property, int height, int charm) {
        this.name = name;
        this.sex = sex;
        this.property = property;
        this.height = height;
        this.charm = charm;
    }
}

public class testW2 {

    public static boolean compare(traveller a, traveller b) {
        if(a.property == 'D') return true;
        if(a.property == 'A' || (a.property == 'B' && a.sex == b.sex) || (a.property == 'C' && a.sex != b.sex)) {
            if(a.height < b.height && a.charm > b.charm) return true;
        }
        return false;
    }

    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int n = scanner.nextInt();
        traveller[] travellers = new traveller[n];
        traveller host = new traveller("host", 0, 'D', 165, 90);
        for (int i = 0; i < n; i++) {
            travellers[i] = new traveller(scanner.next(), scanner.nextInt(), scanner.next().charAt(0), scanner.nextInt(), scanner.nextInt());
            if(compare(travellers[i], host)) {
                System.out.println("宣布无人罪");
                System.out.println(travellers[i].name);
                break;
            }
            else if(i == n - 1) {
                System.out.println("罪人舞步旋");
            }
        }
    }
}