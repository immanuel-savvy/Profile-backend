// Third Party Signin
this is the endpoint that grants other platforms permission to another platform,
It provides them back with an authorisation token that is only specific to their platform

How it works is thus:
PlatformX calls the third_party_signin endpoint with its own api-key,
provides its own authorisation token to the header also,
the handler then uses the authorisation to retrieve the platform being requested and its specific profile type.

Now with those information, and the login-details of {uid, and password},
we can now call signin from the backend still using the caller api-key, and that returns an authorisation token that is tied to the calling platform and the called platform profile type.

// Third Party Auth
This endpoint is used to validate the authorisation token of a platform claim from its third party.

How it works is that the caller would provide its api-key, and the authorisation token it got from the third-party-signin, into the header of the request.
The handler uses those information to retrieve the authorisation payload from the db {platform, token}
It should be present, and have a valid profile to it.
Which is returned.


