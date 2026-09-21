package backend;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.FileTime;
import java.time.Instant;
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
                .andExpect(jsonPath("$.skippedCount").isNumber())
                .andExpect(jsonPath("$.elapsedMillis").isNumber())
                // ISO-8601 instants, not epoch numbers.
                .andExpect(jsonPath("$.startedAt").value(org.hamcrest.Matchers.matchesPattern("\\d{4}-\\d{2}-\\d{2}T.*Z")))
                .andExpect(jsonPath("$.errorCode").doesNotExist())
                .andExpect(jsonPath("$.volume.totalBytes").isNumber())
                .andExpect(jsonPath("$.volume.usableBytes").isNumber());
    }

    @Test
    void reportsStructuredErrors() throws Exception {
        mvc.perform(post("/scans").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("PATH_REQUIRED"))
                .andExpect(jsonPath("$.message").isString());
        mvc.perform(post("/scans").contentType(MediaType.APPLICATION_JSON).content("{"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_REQUEST"))
                .andExpect(jsonPath("$.message").isString());
        mvc.perform(get("/scans/missing"))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("SCAN_NOT_FOUND"))
                .andExpect(jsonPath("$.message").isString());
        mvc.perform(post("/scans").contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of("path", "relative"))))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("PATH_NOT_ABSOLUTE"))
                .andExpect(jsonPath("$.message").isString());
        mvc.perform(post("/scans").contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of("path", temporary.resolve("missing").toString()))))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("FOLDER_NOT_FOUND"));
    }

    @Test
    void identifiesTheApplicationAndItsApiVersion() throws Exception {
        mvc.perform(get("/health").header("Origin", "null"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "null"))
                .andExpect(jsonPath("$.application").value("storage-analyzer"))
                .andExpect(jsonPath("$.apiVersion").value(1))
                .andExpect(jsonPath("$.status").value("UP"));
    }

    @Test
    void reportsThisComputersCapacity() throws Exception {
        mvc.perform(get("/capacity"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.maxHeapBytes").isNumber())
                .andExpect(jsonPath("$.snapshotBudgetBytes").isNumber())
                .andExpect(jsonPath("$.maxEntries").isNumber())
                .andExpect(jsonPath("$.referencePathLength").value(120));
    }

    @Test
    void rejectsMalformedRankingParametersWithACode() throws Exception {
        mvc.perform(get("/scans/missing/largest").param("limit", "many"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_PARAMETER"));
        mvc.perform(get("/scans/missing/largest").param("limit", "0"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_PARAMETER"));
        mvc.perform(get("/scans/missing/largest"))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("SCAN_NOT_FOUND"));
        mvc.perform(get("/scans/missing/skipped").param("offset", "-1"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_PARAMETER"));
        mvc.perform(get("/scans/missing/entry").param("path", temporary.toString()))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("SCAN_NOT_FOUND"));
        mvc.perform(get("/scans/missing/ancestors").param("path", temporary.toString()))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("SCAN_NOT_FOUND"));
        mvc.perform(get("/scans/missing/files").param("offset", "many"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_PARAMETER"));
        mvc.perform(get("/scans/missing/files").param("limit", "101"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_PARAMETER"));
        mvc.perform(get("/scans/missing/files").param("query", "report"))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("SCAN_NOT_FOUND"));
    }

    @Test
    void filtersFilesByTypeAndDateOverHttp() throws Exception {
        Path video = Files.write(temporary.resolve("clip.mp4"), new byte[12]);
        Files.setLastModifiedTime(video, FileTime.from(Instant.parse("2024-05-06T07:08:09Z")));
        Files.write(temporary.resolve("notes.txt"), new byte[3]);
        String body = mvc.perform(post("/scans").contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of("path", temporary.toString()))))
                .andReturn().getResponse().getContentAsString();
        String id = mapper.readTree(body).get("id").asText();
        for (int i = 0; i < 200 && !mapper.readTree(mvc.perform(get("/scans/" + id)).andReturn().getResponse()
                .getContentAsString()).get("status").asText().equals("COMPLETE"); i++) Thread.sleep(10);

        mvc.perform(get("/scans/" + id + "/files").param("category", "VIDEO")
                        .param("modifiedBefore", "2025-01-01T00:00:00Z").param("extension", ".MP4"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.matchingFiles").value(1))
                .andExpect(jsonPath("$.category").value("VIDEO"))
                .andExpect(jsonPath("$.extension").value("mp4"))
                .andExpect(jsonPath("$.modifiedBefore").value("2025-01-01T00:00:00Z"))
                .andExpect(jsonPath("$.modifiedFrom").doesNotExist())
                // Dates are ISO-8601 instants, like the scan's own.
                .andExpect(jsonPath("$.files[0].lastModified").value("2024-05-06T07:08:09Z"))
                .andExpect(jsonPath("$.files[0].category").value("VIDEO"))
                .andExpect(jsonPath("$.files[0].extension").value("mp4"));
        mvc.perform(get("/scans/" + id + "/types"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalBytes").value(15))
                .andExpect(jsonPath("$.catalogVersion").value(1))
                .andExpect(jsonPath("$.categories[0].category").value("VIDEO"))
                .andExpect(jsonPath("$.categories[0].extensions[0].extension").value("mp4"))
                .andExpect(jsonPath("$.categories[1].category").value("DOCUMENT"));
        mvc.perform(get("/scans/" + id + "/directory").param("path", temporary.toString()))
                .andExpect(jsonPath("$.lastModified").doesNotExist())
                .andExpect(jsonPath("$.subdirectories[0].lastModified").value("2024-05-06T07:08:09Z"));

        for (String[] invalid : new String[][]{{"category", "MOVIES"}, {"modifiedFrom", "yesterday"},
                {"modifiedBefore", "2026-01-01"}, {"extension", "tar.gz"}}) {
            mvc.perform(get("/scans/" + id + "/files").param(invalid[0], invalid[1]))
                    .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_PARAMETER"));
        }
        mvc.perform(get("/scans/missing/types"))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("SCAN_NOT_FOUND"));
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
