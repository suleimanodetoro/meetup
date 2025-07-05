// ~/components/Avatar.tsx
import { View, Text, StyleSheet, Image, Button, Alert } from 'react-native'
import React, { useEffect, useState } from 'react'
import { supabase } from '~/utils/supabase'
import * as ImagePicker from 'expo-image-picker'
import * as ImageManipulator from 'expo-image-manipulator'

interface Props {
  size: number
  url: string | null
  onUpload: (filePath: string) => void
}

const Avatar = ({ url, size = 150, onUpload }: Props) => {
  const [uploading, setUploading] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const avatarSize = { height: size, width: size }

  useEffect(() => {
    if (url) downloadImage(url)
  }, [url])

  async function downloadImage(path: string) {
    try {
      const { data, error } = await supabase.storage.from('avatars').download(path)
      if (error) {
        throw error
      }
      const fr = new FileReader()
      fr.readAsDataURL(data)
      fr.onload = () => {
        setAvatarUrl(fr.result as string)
      }
    } catch (error) {
      if (error instanceof Error) {
        console.log('Error downloading image: ', error.message)
      }
    }
  }

  async function compressImage(uri: string): Promise<string> {
    const MAX_SIZE = 1024 * 1024 // 1MB in bytes
    let quality = 0.8
    let compressedUri = uri
    
    // First, resize the image to a reasonable size
    const resizedImage = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 800 } }], // Resize to max width of 800px
      { compress: quality, format: ImageManipulator.SaveFormat.JPEG }
    )
    
    compressedUri = resizedImage.uri
    
    // Check file size and reduce quality if needed
    let fileSize = await getFileSizeFromUri(compressedUri)
    
    while (fileSize > MAX_SIZE && quality > 0.1) {
      quality -= 0.1
      const compressedImage = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 800 } }],
        { compress: quality, format: ImageManipulator.SaveFormat.JPEG }
      )
      compressedUri = compressedImage.uri
      fileSize = await getFileSizeFromUri(compressedUri)
    }
    
    return compressedUri
  }

  async function getFileSizeFromUri(uri: string): Promise<number> {
    const response = await fetch(uri)
    const blob = await response.blob()
    return blob.size
  }

  async function uploadAvatar() {
    try {
      setUploading(true)
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'], // Restrict to only images
        allowsMultipleSelection: false,
        allowsEditing: true,
        quality: 1,
        exif: false,
      })

      if (result.canceled || !result.assets || result.assets.length === 0) {
        console.log('User cancelled image picker.')
        return
      }

      const image = result.assets[0]
      if (!image.uri) {
        throw new Error('No image uri!')
      }

      // Compress the image before uploading
      const compressedUri = await compressImage(image.uri)
      
      const arrayBuffer = await fetch(compressedUri).then((res) => res.arrayBuffer())
      const fileExt = image.uri.split('.').pop()?.toLowerCase() ?? 'jpeg'
      const path = `${Date.now()}.${fileExt}`

      const { data, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, arrayBuffer, {
          contentType: 'image/jpeg', // Always JPEG after compression
        })

      if (uploadError) {
        throw uploadError
      }

      onUpload(data.path)
    } catch (error) {
      if (error instanceof Error) {
        Alert.alert(error.message)
      } else {
        throw error
      }
    } finally {
      setUploading(false)
    }
  }

  return (
    <View>
      {avatarUrl ? (
        <Image
          source={{ uri: avatarUrl }}
          accessibilityLabel="Avatar"
          style={[avatarSize, styles.avatar, styles.image]}
        />
      ) : (
        <View style={[avatarSize, styles.avatar, styles.noImage]} />
      )}
      <View>
        <Button
          title={uploading ? 'Uploading ...' : 'Upload'}
          onPress={uploadAvatar}
          disabled={uploading}
        />
      </View>
    </View>
  )
}

export default Avatar

const styles = StyleSheet.create({
  avatar: {
    borderRadius: 5,
    overflow: 'hidden',
    maxWidth: '100%',
  },
  image: {
    objectFit: 'cover',
    paddingTop: 0,
  },
  noImage: {
    backgroundColor: '#333',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'rgb(200, 200, 200)',
    borderRadius: 5,
  },
})