import 'package:firebase_storage/firebase_storage.dart';
import 'package:image_picker/image_picker.dart';

// Injectable wrapper so widget tests can fake camera + Firebase Storage.
class PhotoUploader {
  const PhotoUploader();

  Future<String?> pickAndUpload(
    String storagePath, {
    ImageSource source = ImageSource.camera,
  }) async {
    final file = await ImagePicker().pickImage(source: source);
    if (file == null) return null;
    final ref = FirebaseStorage.instance.ref(storagePath);
    await ref.putData(await file.readAsBytes());
    return ref.getDownloadURL();
  }
}
