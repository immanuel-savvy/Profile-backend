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


// Signup_with aka third party signup
You provide in the hearder, the xplatform which is the authorised platform
You provide the authorisation from the xplatform profile,
and the api_key to the requesting platform.

In the body, you provide permissions checked to pass down to the requesting platform that the authorised platform already has.
These permissions are basically other services that may have been granted access to the xplatform by their profile.
And profile_type of the platform where the profile will be.

The shape of the permissions is an array of services uris.

So now how does the header information get used to create their profile x.
From the authorisation, we derive the profile.
From the platform we retrieve its setting to get its profile schema.
The profile schema is used to collect the values from the authorised profile,
and then inserted into the profiles of the platform along with profiletype, and platform id.

A webhook is further sent to the xplatform carrying the platform, profile, and xprofile.