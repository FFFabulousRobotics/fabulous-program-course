import java.util.Scanner;

class Soda {
    private String name;
    private int gender;
    private char property;
    private int height;
    private int charm;

    public Soda(String name, int gender, char property, int height, int charm) {
        this.name = name;
        this.gender = gender;
        this.property = property;
        this.height = height;
        this.charm = charm;
    }
    public String getName() { return name; }
    public int getGender() { return gender; }
    public char getProperty() { return property; }
    public int getHeight() { return height; }
    public int getCharm() { return charm; }
    public void setHeight(int height) {
        if (height >= 0) this.height = height;
    }
    public void setCharm(int charm) {
        if (charm >= 0 && charm <= 100) this.charm = charm;
    }
    public boolean canMatch(Soda other) {
        if (this.property == 'D') {
            if (other.getProperty() == 'D') return true;
            boolean genderOk = false;
            if (other.getProperty() == 'A') genderOk = true;
            else if (other.getProperty() == 'B') genderOk = this.gender == other.getGender();
            else if (other.getProperty() == 'C') genderOk = this.gender != other.getGender();
            return genderOk && other.getHeight() < this.height && other.getCharm() > this.charm;
        }
        if (this.property == 'A') return true;
        if (this.property == 'B') return this.gender == other.getGender();
        if (this.property == 'C') return this.gender != other.getGender();
        return false;
    }
    public void showInfo() {
        System.out.println("本地盐汽水 " + name + " " + gender + " " + property + " " + height + " " + charm);
    }
    public void showInfo(String prefix) {
        System.out.println(prefix + " " + name + " " + gender + " " + property + " " + height + " " + charm);
    }
}
class ForeignTraveler extends Soda {
    private String origin;
    public ForeignTraveler(String name, int gender, char property, int height, int charm, String origin) {
        super(name, gender, property, height, charm);
        this.origin = origin;
    }
    public String getOrigin() { return origin; }
    @Override
    public void showInfo() {
        System.out.println("异乡旅行者 " + getName() + " " + getGender() + " " + getProperty() + " " + getHeight() + " " + getCharm() + " 来自:" + origin);
    }
    @Override
    public boolean canMatch(Soda other) {
        if (other.getHeight() <= 160) return false;
        return super.canMatch(other);
    }
}
public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        Soda[] travelers = new Soda[n];
        for (int i = 0; i < n; i++) {
            String type = sc.next();
            if (type.equals("Local")) {
                travelers[i] = new Soda(sc.next(), sc.nextInt(), sc.next().charAt(0), sc.nextInt(), sc.nextInt());
            } else {
                travelers[i] = new ForeignTraveler(sc.next(), sc.nextInt(), sc.next().charAt(0), sc.nextInt(), sc.nextInt(), sc.next());
            }
        }
        Soda host = new Soda("主办人", 0, 'D', 165, 90);
        boolean found = false;
        for (int i = 0; i < n; i++) {
            Soda t = travelers[i];
            if (t.canMatch(host) && host.canMatch(t)) {
                System.out.println("宣布无人罪");
                t.showInfo();
                found = true;
                break;
            }
        }
        if (!found) System.out.println("罪人舞步旋");
    }
}
