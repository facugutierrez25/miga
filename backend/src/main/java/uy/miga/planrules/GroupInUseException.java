package uy.miga.planrules;
class GroupInUseException extends RuntimeException {
    final int meals;
    final int foods;
    GroupInUseException(String name, int meals, int rules) {
        super("El grupo «" + name + "» se usa en " + meals + " comida(s) y " + rules
            + " alimento(s). Quitalo de ahí antes de borrarlo.");
        this.meals = meals; foods = rules;
    }
}
