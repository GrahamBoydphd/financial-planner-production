
## 📋 Zero-Defect Audit Checklist for Code Architects

Use this checklist to verify repository compliance with the Master Fortress Standard.

### Phase 1: Data Type & Precision Audit

- [ ] **Grep for `f64`**: Ensure no floats exist in `backend/src/handlers/` or `projection.rs`.
    
- [ ] **String Verification**: Confirm all decimal/percentage inputs in API DTOs (Data Transfer Objects) are defined as `String`.
    
- [ ] **Percentage Normalization**: Verify the engine divides incoming `_percent` strings by `100.0` only once inside the projection loop.
    

### Phase 2: Naming & Schema Audit

- [ ] **Field Naming**: Check that no database table or API response uses the bare key `name` (must be `role_name`, etc.).
    
- [ ] **Suffix Check**: Confirm every growth/interest field ends in `_percent`.
    
- [ ] **Casing Check**: Verify the frontend/API layer lowercases all enums (e.g., `Fixed_Count` → `fixed_count`) before transmission.
    

### Phase 3: SQL & Database Integrity

- [ ] **Wildcard Scan**: Ensure `SELECT *` is removed from all `sqlx` macros.
    
- [ ] **Nullability Check**: Confirm every `created_at` field is non-nullable and queried with the `!` suffix.
    
- [ ] **Comment Syntax**: Replace any `#` comments in SQL or Rust `r#""#` literals with `--`.
    

### Phase 4: Logic & Calculation Audit

- [ ] **Median Pathing**: Inspect `projection.rs` to ensure P50 values are pulled from the monthly median trajectory, not an average of final results.
    
- [ ] **Anniversary Logic**: Verify raises use `(m - role.start_month) / 12` rather than global calendar years.
    

