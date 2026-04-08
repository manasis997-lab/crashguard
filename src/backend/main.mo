import Map "mo:core/Map";
import List "mo:core/List";
import Text "mo:core/Text";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import OutCall "http-outcalls/outcall";
import Storage "blob-storage/Storage";
import MixinAuthorization "authorization/MixinAuthorization";
import AccessControl "authorization/access-control";
import MixinStorage "blob-storage/Mixin";

actor {
  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);
  include MixinStorage();

  public type EmergencyContact = {
    name : Text;
    phone : Text;
  };

  public type AccidentRecord = {
    id : Text;
    location : Text;
    videoUrl : Text;
    status : Text;
  };

  public type UserProfile = {
    userName : Text;
    phoneNumber : Text;
    videoEvidence : ?Storage.ExternalBlob;
  };

  // Store user profiles
  let profiles = Map.empty<Principal, UserProfile>();

  // Store contacts per user
  let contactsMap = Map.empty<Principal, List.List<EmergencyContact>>();

  // Store accidents per user
  let accidentsMap = Map.empty<Principal, List.List<AccidentRecord>>();

  public query ({ caller }) func transform(input : OutCall.TransformationInput) : async OutCall.TransformationOutput {
    OutCall.transform(input);
  };

  // Required: Get caller's own profile
  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view profiles");
    };
    profiles.get(caller);
  };

  // Required: Save caller's own profile
  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can save profiles");
    };
    profiles.add(caller, profile);
  };

  // Required: Get any user's profile (admin or self only)
  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only view your own profile");
    };
    profiles.get(user);
  };

  public shared ({ caller }) func saveProfile(profile : UserProfile) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can save profiles");
    };
    switch (profiles.get(caller)) {
      case (null) { profiles.add(caller, profile) };
      case (?_) {
        Runtime.trap("Profile already exists");
      };
    };
  };

  public shared ({ caller }) func addEmergencyContact(contact : EmergencyContact) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can add emergency contacts");
    };
    // Check if user has a profile
    switch (profiles.get(caller)) {
      case (null) {
        Runtime.trap("No profile found. Please create a profile first.");
      };
      case (?_) {
        let currentContacts = switch (contactsMap.get(caller)) {
          case (null) { List.empty<EmergencyContact>() };
          case (?contacts) { contacts };
        };
        currentContacts.add(contact);
        contactsMap.add(caller, currentContacts);
      };
    };
  };

  public shared ({ caller }) func removeEmergencyContact(phone : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can remove emergency contacts");
    };
    switch (contactsMap.get(caller)) {
      case (null) { };
      case (?contacts) {
        let filtered = List.empty<EmergencyContact>();
        for (contact in contacts.toArray().vals()) {
          if (contact.phone != phone) {
            filtered.add(contact);
          };
        };
        contactsMap.add(caller, filtered);
      };
    };
  };

  public shared ({ caller }) func reportAccident(record : AccidentRecord) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can report accidents");
    };
    // Only validate location/video for non-cancelled events
    if (record.status != "cancelled") {
      if (record.location == "") {
        Runtime.trap("Location is required");
      };
    };

    let currentRecords = switch (accidentsMap.get(caller)) {
      case (null) { List.empty<AccidentRecord>() };
      case (?records) { records };
    };
    currentRecords.add(record);
    accidentsMap.add(caller, currentRecords);
  };

  public query ({ caller }) func getMyEmerContacts() : async [EmergencyContact] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view emergency contacts");
    };
    switch (contactsMap.get(caller)) {
      case (null) { [] };
      case (?contacts) { contacts.toArray() };
    };
  };

  public query ({ caller }) func getUserAccidents() : async [AccidentRecord] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view their accidents");
    };
    switch (accidentsMap.get(caller)) {
      case (null) { [] };
      case (?records) { records.toArray() };
    };
  };

  // Admin function: View all accident records across all users
  public query ({ caller }) func getAllAccidents() : async [(Principal, [AccidentRecord])] {
    if (not (AccessControl.isAdmin(accessControlState, caller))) {
      Runtime.trap("Unauthorized: Only admins can view all accident records");
    };
    let result = List.empty<(Principal, [AccidentRecord])>();
    for ((user, records) in accidentsMap.entries()) {
      result.add((user, records.toArray()));
    };
    result.toArray();
  };

  public shared ({ caller }) func sendSms(phone : Text, message : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can send SMS alerts");
    };
    let sid = "twilio_SID";
    let authToken = "credentials";
    let url = "https://api.twilio.com/2010-04-01/Accounts/" # sid # "/Messages.json";

    let body = "To=" # phone # "&From=twilio_number&Body=" # message;

    let authHeader = "Basic " # "Base64 encoded credentials";

    let headers = [
      { name = "Authorization"; value = authHeader },
      { name = "Content-Type"; value = "application/x-www-form-urlencoded" },
    ];

    ignore await OutCall.httpPostRequest(url, headers, body, transform);
  };
};
