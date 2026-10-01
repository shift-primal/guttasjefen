CREATE FUNCTION notify_example_changed() RETURNS trigger AS $$
BEGIN
	PERFORM pg_notify('example_changed', '');
	RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER example_changed
AFTER INSERT OR DELETE OR UPDATE OF text, liked ON "example"
FOR EACH STATEMENT EXECUTE FUNCTION notify_example_changed();
--> statement-breakpoint
CREATE FUNCTION clear_example_tags() RETURNS trigger AS $$
BEGIN
	IF NEW.text IS DISTINCT FROM OLD.text THEN
		NEW.tags := NULL;
	END IF;
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER example_text_changed
BEFORE UPDATE OF text ON "example"
FOR EACH ROW EXECUTE FUNCTION clear_example_tags();
--> statement-breakpoint
CREATE FUNCTION notify_bot_job_created() RETURNS trigger AS $$
BEGIN
	PERFORM pg_notify('bot_job_created', '');
	RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER bot_job_created
AFTER INSERT ON "bot_job"
FOR EACH STATEMENT EXECUTE FUNCTION notify_bot_job_created();
--> statement-breakpoint
DELETE FROM "setting" WHERE "key" = 'example-tags';
