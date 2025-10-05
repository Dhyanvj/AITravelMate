// Test Supabase Storage Connection
// Run this in your app to test if storage is working

import { supabase } from './src/services/supabase/supabaseClient';

export const testStorageConnection = async () => {
  try {
    console.log('Testing Supabase Storage connection...');
    
    // Test 1: List buckets
    console.log('1. Testing bucket listing...');
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
    
    if (bucketError) {
      console.error('❌ Error listing buckets:', bucketError);
      return false;
    }
    
    console.log('✅ Buckets found:', buckets.map(b => b.id));
    
    // Test 2: Check if chat-files bucket exists
    const chatFilesBucket = buckets.find(bucket => bucket.id === 'chat-files');
    if (!chatFilesBucket) {
      console.error('❌ chat-files bucket not found');
      console.log('Available buckets:', buckets.map(b => b.id));
      return false;
    }
    
    console.log('✅ chat-files bucket found:', chatFilesBucket);
    
    // Test 3: Try to list files in the bucket
    console.log('2. Testing file listing...');
    const { data: files, error: listError } = await supabase.storage
      .from('chat-files')
      .list('', { limit: 1 });
    
    if (listError) {
      console.error('❌ Error listing files:', listError);
      return false;
    }
    
    console.log('✅ File listing works, found', files.length, 'files');
    
    // Test 4: Try to upload a small test file
    console.log('3. Testing file upload...');
    const testContent = 'Hello, this is a test file!';
    const testBlob = new Blob([testContent], { type: 'text/plain' });
    const testPath = `test-${Date.now()}.txt`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('chat-files')
      .upload(testPath, testBlob, {
        contentType: 'text/plain',
        upsert: false
      });
    
    if (uploadError) {
      console.error('❌ Error uploading test file:', uploadError);
      return false;
    }
    
    console.log('✅ Test file uploaded successfully:', uploadData);
    
    // Test 5: Try to get public URL
    console.log('4. Testing public URL generation...');
    const { data: { publicUrl } } = supabase.storage
      .from('chat-files')
      .getPublicUrl(testPath);
    
    console.log('✅ Public URL generated:', publicUrl);
    
    // Test 6: Clean up test file
    console.log('5. Cleaning up test file...');
    const { error: deleteError } = await supabase.storage
      .from('chat-files')
      .remove([testPath]);
    
    if (deleteError) {
      console.warn('⚠️ Error deleting test file:', deleteError);
    } else {
      console.log('✅ Test file cleaned up');
    }
    
    console.log('🎉 All storage tests passed!');
    return true;
    
  } catch (error) {
    console.error('❌ Storage test failed:', error);
    return false;
  }
};

// Usage: Call this function to test storage
// testStorageConnection().then(success => {
//   console.log('Storage test result:', success);
// });
