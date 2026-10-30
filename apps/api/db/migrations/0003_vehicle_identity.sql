-- Keep historical display formatting while enforcing one identity per company.
CREATE UNIQUE INDEX vehicle_registration_identity ON vehicles (
 company_id, regexp_replace(upper(registration),'[^A-Z0-9]','','g')
);
