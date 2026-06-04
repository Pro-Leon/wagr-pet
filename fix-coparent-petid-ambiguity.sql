-- Fix: "column reference 'pet_id' is ambiguous" in accept_co_parent_invite
-- The RETURNS TABLE (pet_id ...) OUT parameter clashed with ON CONFLICT (pet_id, ...)
DROP FUNCTION IF EXISTS accept_co_parent_invite(text,uuid);
CREATE FUNCTION accept_co_parent_invite(invite_token TEXT, accepting_user_id UUID)
RETURNS TABLE (out_pet_id UUID, pet_name TEXT, owner_email TEXT)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    inv RECORD;
BEGIN
    SELECT * INTO inv FROM co_parent_invites
    WHERE token = invite_token AND used = false AND expires_at > NOW()
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invite not found, already used, or expired';
    END IF;

    UPDATE co_parent_invites SET used = true WHERE id = inv.id;

    INSERT INTO co_parents (pet_id, user_id, invited_by)
    VALUES (inv.pet_id, accepting_user_id, inv.invited_by)
    ON CONFLICT (pet_id, user_id) DO NOTHING;

    RETURN QUERY
    SELECT inv.pet_id, p.name::TEXT, u.email::TEXT
    FROM pets p
    JOIN auth.users u ON u.id = p.user_id
    WHERE p.id = inv.pet_id;
END;
$$;
