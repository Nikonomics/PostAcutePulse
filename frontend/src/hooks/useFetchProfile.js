// hooks/useFetchProfile.js
import { useEffect, useState } from "react";
import { getMyProfileDetails } from "api/authService";

export const useFetchProfile = () => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async () => {
    try {
      const res = await getMyProfileDetails();
      if (res.success) {
        setProfile(res.body);
      }
    } catch (err) {
      console.error("Failed to fetch profile:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  return { profile, loading, refetchProfile: fetchProfile };
};
