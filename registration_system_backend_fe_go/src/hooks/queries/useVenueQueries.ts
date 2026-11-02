import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listVenues, setVenueImage, uploadVenueImage } from "../../api/venues";

const venueQueryKey = ["venues"] as const;

export function useVenuesQuery() {
  return useQuery({
    queryKey: venueQueryKey,
    queryFn: listVenues,
    retry: false,
  });
}

export function useUploadVenueImageMutation() {
  return useMutation({ mutationFn: uploadVenueImage });
}

export function useSetVenueImageMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      location,
      imageUrl,
    }: {
      location: string;
      imageUrl: string;
    }) => setVenueImage(location, imageUrl),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: venueQueryKey }),
  });
}
