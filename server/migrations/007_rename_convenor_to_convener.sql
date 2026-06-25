-- Rename Convenor to Convener in the club_members table
UPDATE club_members SET designation = 'Convener' WHERE designation = 'Convenor';
