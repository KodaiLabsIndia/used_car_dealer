CREATE FUNCTION protect_attendance_facts() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Attendance facts cannot be deleted'; END IF;
 IF OLD.status<>'open' OR NEW.status NOT IN ('closed','missed_out') OR NEW.version<>OLD.version+1 THEN
  RAISE EXCEPTION 'Attendance can only close an open saved session';
 END IF;
 IF ROW(NEW.id,NEW.company_id,NEW.user_id,NEW.work_date,NEW.punched_in_at,NEW.schedule,NEW.policy,NEW.policy_version,NEW.selfie_required,NEW.starts_at,NEW.ends_at,NEW.cutoff_at,NEW.proof_id)
 IS DISTINCT FROM ROW(OLD.id,OLD.company_id,OLD.user_id,OLD.work_date,OLD.punched_in_at,OLD.schedule,OLD.policy,OLD.policy_version,OLD.selfie_required,OLD.starts_at,OLD.ends_at,OLD.cutoff_at,OLD.proof_id) THEN
  RAISE EXCEPTION 'Saved punch-in evidence and shift rules are immutable';
 END IF;
 IF NEW.status='closed' AND (NEW.punched_out_at<NEW.punched_in_at OR NEW.punched_out_at>=NEW.cutoff_at OR NEW.minutes<>floor(extract(epoch FROM (NEW.punched_out_at-NEW.punched_in_at))/60)) THEN
  RAISE EXCEPTION 'Punch-out must preserve actual recorded time';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER protect_attendance_facts BEFORE UPDATE OR DELETE ON attendance_sessions FOR EACH ROW EXECUTE FUNCTION protect_attendance_facts();
ALTER TABLE workforce_pay_events ADD CONSTRAINT workforce_payment_positive CHECK(kind NOT IN ('advance_payment','salary_payment') OR amount_paise>0);
