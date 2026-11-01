package uy.miga;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Proxy;
import java.sql.*;
import javax.sql.DataSource;
import org.springframework.beans.factory.config.BeanPostProcessor;
import org.springframework.context.annotation.Bean;
import org.springframework.boot.test.context.TestConfiguration;

// Statistics no cuenta JdbcTemplate: el proxy cuenta ejecuciones JDBC, incluidas las nativas.
// El alcance por hilo excluye workers y limita la conteo a una peticion MockMvc sincrona.
public final class SqlRequestCounter implements AutoCloseable {
    private static final ThreadLocal<SqlRequestCounter> CURRENT = new ThreadLocal<>();
    private int statements;
    public static SqlRequestCounter start() {
        var counter = new SqlRequestCounter();
        CURRENT.set(counter);
        return counter;
    }
    public int statements() { return statements; }
    public void close() { CURRENT.remove(); }

    private static Object wrap(Object target, Class<?> type) {
        return Proxy.newProxyInstance(SqlRequestCounter.class.getClassLoader(), new Class<?>[]{type},
            (proxy, method, args) -> {
                if (target instanceof Statement && method.getName().startsWith("execute")) {
                    var counter = CURRENT.get();
                    if (counter != null) counter.statements++;
                }
                try {
                    Object result = method.invoke(target, args);
                    if (result instanceof Connection) return wrap(result, Connection.class);
                    if (result instanceof CallableStatement) return wrap(result, CallableStatement.class);
                    if (result instanceof PreparedStatement) return wrap(result, PreparedStatement.class);
                    if (result instanceof Statement) return wrap(result, Statement.class);
                    return result;
                } catch (InvocationTargetException ex) { throw ex.getCause(); }
            });
    }

    @TestConfiguration(proxyBeanMethods = false)
    public static class Configuration {
        @Bean
        static BeanPostProcessor sqlCounterDataSource() {
            return new BeanPostProcessor() {
                @Override public Object postProcessAfterInitialization(Object bean, String name) {
                    return bean instanceof DataSource ? wrap(bean, DataSource.class) : bean;
                }
            };
        }
    }
}
