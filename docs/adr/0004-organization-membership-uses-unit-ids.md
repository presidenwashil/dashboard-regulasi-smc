# Model User membership through Unit IDs

Each User belongs to one Unit Organisasi, and each Unit Organisasi has one parent Bidang. Store the membership and parent relationship by stable numeric IDs rather than deriving Bidang from Profesi or joining on names; names may change or repeat, while an Admin-reviewed crosswalk is required to migrate ambiguous legacy values. Document targets and the uploader's first-upload Bidang snapshot also use Bidang IDs, while access to target Bidang follows current User membership.
