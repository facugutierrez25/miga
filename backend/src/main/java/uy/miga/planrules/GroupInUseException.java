package uy.miga.planrules;
class GroupInUseException extends RuntimeException {
    final int comidas;
    final int alimentos;
    GroupInUseException(String name, int meals, int rules) {
        super("El grupo «" + name + "» se usa en " + meals + " comida(s) y " + rules + " alimento(s). Quitalo de ahí antes de borrarlo.");
        comidas = meals; alimentos = rules;
    }
}
