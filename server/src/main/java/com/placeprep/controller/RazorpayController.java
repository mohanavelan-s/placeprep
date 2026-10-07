package com.placeprep.controller;

import com.placeprep.model.User;
import com.placeprep.security.CurrentUser;
import com.placeprep.service.BillingService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api")
public class RazorpayController {

    private final BillingService billingService;

    public RazorpayController(BillingService billingService) {
        this.billingService = billingService;
    }

    @PostMapping("/create-order")
    public ResponseEntity<Map<String, Object>> createOrder(
            @CurrentUser User user,
            @RequestBody(required = false) Map<String, Object> req
    ) {
        Map<String, Object> res = billingService.createCheckoutSession(user, req != null ? req : Map.of());
        return ResponseEntity.ok(Map.of("success", true, "data", res));
    }

    @PostMapping("/verify-payment")
    public ResponseEntity<Map<String, Object>> verifyPayment(
            @CurrentUser User user,
            @RequestBody Map<String, Object> req
    ) {
        Map<String, Object> res = billingService.verifyPayment(user, req);
        return ResponseEntity.ok(Map.of("success", true, "data", res));
    }
}
