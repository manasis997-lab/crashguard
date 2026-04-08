import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangle,
  Loader2,
  Phone,
  Save,
  Trash2,
  User,
  UserPlus,
  Users,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  useAddEmergencyContact,
  useEmergencyContacts,
  useRemoveEmergencyContact,
  useSaveProfile,
  useUserProfile,
} from "../hooks/useQueries";

const MAX_CONTACTS = 5;

export default function ContactsPage() {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [profileName, setProfileName] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [confirmDeletePhone, setConfirmDeletePhone] = useState<string | null>(
    null,
  );

  const { data: contacts = [], isLoading: loadingContacts } =
    useEmergencyContacts();
  const { data: profile } = useUserProfile();
  const addContact = useAddEmergencyContact();
  const removeContact = useRemoveEmergencyContact();
  const saveProfile = useSaveProfile();

  useEffect(() => {
    if (profile) {
      setProfileName(profile.userName ?? "");
      setProfilePhone(profile.phoneNumber ?? "");
    }
  }, [profile]);

  const handleAddContact = async () => {
    if (!name.trim() || !phone.trim()) {
      toast.error("Name and phone are required");
      return;
    }
    if (contacts.length >= MAX_CONTACTS) {
      toast.error(`Maximum ${MAX_CONTACTS} contacts allowed`);
      return;
    }
    try {
      await addContact.mutateAsync({ name: name.trim(), phone: phone.trim() });
      toast.success("Contact added");
      setName("");
      setPhone("");
      setIsOpen(false);
    } catch {
      toast.error("Failed to add contact");
    }
  };

  const handleDeleteContact = async (phone: string) => {
    try {
      await removeContact.mutateAsync(phone);
      toast.success("Contact removed");
      setConfirmDeletePhone(null);
    } catch {
      toast.error("Failed to remove contact");
    }
  };

  const handleSaveProfile = async () => {
    if (!profileName.trim() || !profilePhone.trim()) {
      toast.error("Name and phone number are required");
      return;
    }
    try {
      await saveProfile.mutateAsync({
        userName: profileName.trim(),
        phoneNumber: profilePhone.trim(),
      });
      toast.success("Profile saved");
    } catch {
      toast.error("Failed to save profile");
    }
  };

  const contactToDelete = contacts.find((c) => c.phone === confirmDeletePhone);

  return (
    <main className="flex flex-col min-h-[calc(100dvh-80px)] pb-24 px-4 pt-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h1 className="font-display text-2xl font-bold text-foreground">
          Emergency Contacts
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {contacts.length}/{MAX_CONTACTS} contacts \u00b7 notified on crash
          detection
        </p>
      </motion.div>

      {/* Contacts List */}
      <div className="flex-1 mb-6">
        {loadingContacts ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : contacts.length === 0 ? (
          <motion.div
            data-ocid="contacts.empty_state"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-16 gap-3"
          >
            <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center">
              <Users size={28} className="text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-sm font-medium">
              No emergency contacts added
            </p>
            <p className="text-muted-foreground/60 text-xs text-center max-w-[200px]">
              Add up to 5 people to notify when a crash is detected
            </p>
          </motion.div>
        ) : (
          <div data-ocid="contacts.list" className="space-y-3">
            <AnimatePresence>
              {contacts.map((contact, i) => (
                <motion.div
                  key={`${contact.phone}-${i}`}
                  data-ocid={`contacts.item.${i + 1}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Card className="border-border/50 hover:border-border transition-colors">
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="font-display font-bold text-primary text-sm">
                          {contact.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-foreground truncate">
                          {contact.name}
                        </p>
                        <p className="text-muted-foreground text-xs flex items-center gap-1 mt-0.5">
                          <Phone size={10} />
                          {contact.phone}
                        </p>
                      </div>
                      <Button
                        data-ocid={`contacts.delete_button.${i + 1}`}
                        size="icon"
                        variant="ghost"
                        className="w-8 h-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setConfirmDeletePhone(contact.phone)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Add Contact FAB */}
      {contacts.length < MAX_CONTACTS && (
        <motion.button
          type="button"
          data-ocid="contacts.open_modal_button"
          className="fixed bottom-24 right-4 w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-glow z-30"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsOpen(true)}
        >
          <UserPlus size={22} />
        </motion.button>
      )}

      {/* Profile Section */}
      <Separator className="mb-5" />
      <div className="mb-4">
        <h2 className="font-display text-lg font-bold text-foreground mb-1">
          Your Profile
        </h2>
        <p className="text-muted-foreground text-xs mb-4">
          Used in SMS alerts sent to your contacts
        </p>
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">
              Your Name
            </Label>
            <div className="relative">
              <User
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                data-ocid="profile.name.input"
                className="pl-9"
                placeholder="John Doe"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">
              Your Phone Number
            </Label>
            <div className="relative">
              <Phone
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                data-ocid="profile.phone.input"
                className="pl-9"
                placeholder="+1234567890"
                type="tel"
                value={profilePhone}
                onChange={(e) => setProfilePhone(e.target.value)}
              />
            </div>
          </div>
          <Button
            data-ocid="profile.save_button"
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
            onClick={handleSaveProfile}
            disabled={saveProfile.isPending}
          >
            {saveProfile.isPending ? (
              <Loader2 className="mr-2 w-4 h-4 animate-spin" />
            ) : (
              <Save className="mr-2 w-4 h-4" />
            )}
            Save Profile
          </Button>
        </div>
      </div>

      {/* Add Contact Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent
          data-ocid="contacts.modal"
          className="max-w-[360px] mx-auto"
        >
          <DialogHeader>
            <DialogTitle className="font-display">
              Add Emergency Contact
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">
                Full Name
              </Label>
              <div className="relative">
                <User
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  data-ocid="contact.name.input"
                  className="pl-9"
                  placeholder="Jane Smith"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddContact()}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">
                Phone Number
              </Label>
              <div className="relative">
                <Phone
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  data-ocid="contact.phone.input"
                  className="pl-9"
                  placeholder="+1234567890"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddContact()}
                />
              </div>
            </div>
            <Button
              data-ocid="contact.save_button"
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
              onClick={handleAddContact}
              disabled={addContact.isPending}
            >
              {addContact.isPending ? (
                <Loader2 className="mr-2 w-4 h-4 animate-spin" />
              ) : (
                <UserPlus className="mr-2 w-4 h-4" />
              )}
              Add Contact
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Dialog */}
      <Dialog
        open={!!confirmDeletePhone}
        onOpenChange={(open) => !open && setConfirmDeletePhone(null)}
      >
        <DialogContent
          data-ocid="contacts.delete_dialog"
          className="max-w-[360px] mx-auto"
        >
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <AlertTriangle size={18} className="text-destructive" />
              Remove Contact
            </DialogTitle>
          </DialogHeader>
          <div className="pt-2 space-y-4">
            <p className="text-sm text-muted-foreground">
              Remove{" "}
              <span className="font-semibold text-foreground">
                {contactToDelete?.name}
              </span>{" "}
              ({contactToDelete?.phone}) from your emergency contacts? They will
              no longer be notified on crash detection.
            </p>
            <div className="flex gap-2">
              <Button
                data-ocid="contacts.cancel_button"
                variant="outline"
                className="flex-1"
                onClick={() => setConfirmDeletePhone(null)}
              >
                Cancel
              </Button>
              <Button
                data-ocid="contacts.confirm_button"
                variant="destructive"
                className="flex-1"
                onClick={() =>
                  confirmDeletePhone && handleDeleteContact(confirmDeletePhone)
                }
                disabled={removeContact.isPending}
              >
                {removeContact.isPending ? (
                  <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 w-4 h-4" />
                )}
                Remove
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
