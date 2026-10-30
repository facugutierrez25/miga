package uy.miga;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class MigaApplication {

    public static void main(String[] args) {
        SpringApplication.run(MigaApplication.class, args);
    }
}
