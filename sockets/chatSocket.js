const chatSocket = (io) => {
  io.on('connection', (socket) => {
    console.log('User connected:', socket.id)

    // Join a chat room
    socket.on('join_chat', (chatId) => {
      socket.join(chatId)
      console.log(`User joined chat: ${chatId}`)
    })

    // Leave a chat room
    socket.on('leave_chat', (chatId) => {
      socket.leave(chatId)
      console.log(`User left chat: ${chatId}`)
    })

    // Send message in real time
    socket.on('send_message', (data) => {
      io.to(data.chatId).emit('receive_message', data)
    })

    // Typing indicator
    socket.on('typing', (data) => {
      socket.to(data.chatId).emit('user_typing', data)
    })

    // Stop typing
    socket.on('stop_typing', (data) => {
      socket.to(data.chatId).emit('user_stop_typing', data)
    })

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id)
    })
  })
}

export default chatSocket