package com.placeprep.controller;

import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.concurrent.TimeUnit;

@RestController
public class AssetController {

    @GetMapping(value = {"/logo.svg", "/favicon.svg", "/mcp/logo.svg"}, produces = "image/svg+xml")
    public ResponseEntity<Resource> getLogoSvg() {
        Resource resource = new ClassPathResource("static/logo.svg");
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(1, TimeUnit.DAYS).cachePublic())
                .contentType(MediaType.parseMediaType("image/svg+xml"))
                .body(resource);
    }

    @GetMapping(value = {"/logo.png", "/favicon.png", "/mcp/logo.png"}, produces = MediaType.IMAGE_PNG_VALUE)
    public ResponseEntity<Resource> getLogoPng() {
        Resource resource = new ClassPathResource("static/logo.png");
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(1, TimeUnit.DAYS).cachePublic())
                .contentType(MediaType.IMAGE_PNG)
                .body(resource);
    }

    @GetMapping(value = "/favicon.ico", produces = "image/x-icon")
    public ResponseEntity<Resource> getFaviconIco() {
        Resource resource = new ClassPathResource("static/favicon.ico");
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(1, TimeUnit.DAYS).cachePublic())
                .contentType(MediaType.parseMediaType("image/x-icon"))
                .body(resource);
    }
}
