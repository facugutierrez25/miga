package uy.miga.registro;

import java.math.BigDecimal;

record GroupStatusDto(Long foodGroupId, String name, BigDecimal expected,
                      BigDecimal recorded, String status, BigDecimal dailyGoal) {}
