package uy.miga;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.HashMap;
import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/**
 * Agrega a un guardado de plan la versión vigente, como hace un cliente al día
 * (PUT /api/v1/my-plan exige la versión cuando ya existe un plan).
 */
public final class PlanVersions {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private PlanVersions() {}

    public static Long current(MockMvc mockMvc, String token) throws Exception {
        MvcResult result = mockMvc.perform(get("/api/v1/my-plan")
                .header("Authorization", "Bearer " + token))
            .andReturn();
        if (result.getResponse().getStatus() != 200) return null;
        return MAPPER.readTree(result.getResponse().getContentAsString()).path("version").asLong();
    }

    public static String withCurrentVersion(MockMvc mockMvc, String token, String planJson) throws Exception {
        Long version = current(mockMvc, token);
        if (version == null) return planJson;
        ObjectNode plan = (ObjectNode) MAPPER.readTree(planJson);
        plan.put("clientVersion", version);
        return MAPPER.writeValueAsString(plan);
    }

    public static Map<String, Object> withCurrentVersion(MockMvc mockMvc, String token, Map<String, ?> plan)
            throws Exception {
        Map<String, Object> body = new HashMap<>(plan);
        Long version = current(mockMvc, token);
        if (version != null) body.put("clientVersion", version);
        return body;
    }
}
