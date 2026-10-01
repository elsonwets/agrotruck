// Photo réduite avant l'envoi : un cliché de téléphone (5 à 12 Mo) passe à quelques centaines de Ko, ce qui tient
// sur une connexion lente. Toujours en JPEG (certains téléphones donnent un type vide ou du HEIC illisible ailleurs).
// Si le navigateur ne sait pas décoder l'image, on envoie le fichier d'origine.
export async function shrinkImage(file: File, maxSide = 1600, quality = 0.8): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    return blob ?? file;
  } catch {
    return file;
  }
}
