CREATE OR REPLACE FUNCTION public.mbg_pbkdf2_sha256(
  p_password TEXT,
  p_salt TEXT,
  p_iterations INTEGER,
  p_output_length INTEGER
)
RETURNS BYTEA
LANGUAGE plpgsql
IMMUTABLE
STRICT
PARALLEL SAFE
SET search_path = pg_catalog, public
AS $function$
DECLARE
  key_bytes BYTEA := convert_to(p_password, 'UTF8');
  salt_bytes BYTEA := convert_to(p_salt, 'UTF8');
  output BYTEA := decode('', 'hex');
  u BYTEA;
  t BYTEA;
  block_index INTEGER := 1;
  iteration INTEGER;
  byte_index INTEGER;
  remaining INTEGER;
BEGIN
  IF p_iterations < 1 OR p_iterations > 600000 OR p_output_length NOT IN (32, 64) THEN
    RAISE EXCEPTION 'Invalid PBKDF2 parameters' USING ERRCODE = '22023';
  END IF;

  LOOP
    u := public.hmac(salt_bytes || int4send(block_index), key_bytes, 'sha256');
    t := u;

    FOR iteration IN 2..p_iterations LOOP
      u := public.hmac(u, key_bytes, 'sha256');
      FOR byte_index IN 0..31 LOOP
        t := set_byte(t, byte_index, get_byte(t, byte_index) # get_byte(u, byte_index));
      END LOOP;
    END LOOP;

    remaining := p_output_length - length(output);
    output := output || substring(t FROM 1 FOR least(32, remaining));
    EXIT WHEN length(output) >= p_output_length;
    block_index := block_index + 1;
  END LOOP;

  RETURN output;
END
$function$;

REVOKE ALL ON FUNCTION public.mbg_pbkdf2_sha256(TEXT, TEXT, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mbg_pbkdf2_sha256(TEXT, TEXT, INTEGER, INTEGER) TO CURRENT_USER;
