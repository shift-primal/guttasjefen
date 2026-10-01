CREATE FUNCTION notify_setting_changed() RETURNS trigger AS $$
BEGIN
	PERFORM pg_notify('setting_changed', COALESCE(NEW.key, OLD.key));
	RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER setting_changed
AFTER INSERT OR UPDATE OR DELETE ON "setting"
FOR EACH ROW EXECUTE FUNCTION notify_setting_changed();
