package backend;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.file.Path;
import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class StorageApiTests {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @TempDir Path temporary;

    @Test
    void startsScansAndProvidesProgressContract() throws Exception {
        mvc.perform(post("/scans").contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of("path", temporary.toString()))))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.id").isString())
                .andExpect(jsonPath("$.path").value(temporary.toString()))
                .andExpect(jsonPath("$.status").isString())
                .andExpect(jsonPath("$.processedFiles").isNumber())
                .andExpect(jsonPath("$.processedDirectories").isNumber())
                .andExpect(jsonPath("$.processedBytes").isNumber())
                .andExpect(jsonPath("$.skippedCount").isNumber());
    }

    @Test
    void reportsStructuredErrors() throws Exception {
        mvc.perform(post("/scans").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").isString());
        mvc.perform(post("/scans").contentType(MediaType.APPLICATION_JSON).content("{"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").isString());
        mvc.perform(get("/scans/missing"))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.message").isString());
        mvc.perform(post("/scans").contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of("path", "relative"))))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").isString());
    }

    @Test
    void doesNotExposeRetiredDirectoryAndMockEndpoints() throws Exception {
        mvc.perform(get("/directory"))
                .andExpect(status().isNotFound());
        mvc.perform(get("/directory").param("path", temporary.toString()))
                .andExpect(status().isNotFound());
        mvc.perform(get("/directory/mock"))
                .andExpect(status().isNotFound());
    }

    @Test
    void allowsLocalPreviewCorsAndRejectsOtherOrigins() throws Exception {
        mvc.perform(options("/scans").header("Origin", "http://localhost:8080")
                        .header("Access-Control-Request-Method", "POST").header("Access-Control-Request-Headers", "content-type"))
                .andExpect(status().isOk()).andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:8080"));
        mvc.perform(options("/scans").header("Origin", "https://example.org")
                        .header("Access-Control-Request-Method", "POST"))
                .andExpect(status().isForbidden());
    }
}
