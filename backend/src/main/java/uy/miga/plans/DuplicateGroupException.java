package uy.miga.plans;
public class DuplicateGroupException extends RuntimeException { public DuplicateGroupException() { super("Ya existe un grupo con esa abreviatura o clave."); } }
