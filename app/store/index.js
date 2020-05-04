import Vuex from 'vuex'
import { vuexfireMutations, firestoreAction } from 'vuexfire'
import { db } from '~/plugins/firebase.js'

const createStore = () => {
  return new Vuex.Store({
    state: {
      rooms: [],
      room: null,
      isOwner: false,
      userId: ''
    },

    mutations: {
      ...vuexfireMutations,
      setUserId(state, userId) {
        state.userId = userId
      },
      setIsOwner(state) {
        state.isOwner = true
      }
    },

    actions: {
      setRoomsRef: firestoreAction(({ bindFirestoreRef }, ref) => {
        bindFirestoreRef('rooms', ref)
      }),
      // roomIdからfirestoreのドキュメントを取得する関数
      // todo: isStartがfalseのroomのみ取得できる
      // todo: エラーハンドリング
      setRoomRef: firestoreAction(async ({ bindFirestoreRef }, roomId) => {
        await bindFirestoreRef('room', db.collection('rooms').doc(roomId))
      }),
      // todo: エラーハンドリング
      async postRoom({ commit }, payload) {
        const res = await db.collection('rooms').add(payload)
        commit('setIsOwner')
        return res.id
      },
      // todo: エラーハンドリング
      startGameAction({ _commit, state }) {
        const ownerUpdata = {
          ...state.room.owner,
          isReady: false
        }
        const guestUpdate = state.room.guest.map((user) => {
          return { ...user, isReady: false }
        })
        db.collection('rooms')
          .doc(state.room.id)
          .update({ isStart: true, owner: ownerUpdata, guest: guestUpdate })
      },
      // todo: エラーハンドリング / payload → stateからid取得
      // todo: トランザクション
      // isStartがfalseの時だけ呼び出せ
      joinRoomAction({ commit, state }, payload) {
        const update = state.room.guest
        update.push(payload.formData)
        db.collection('rooms')
          .doc(payload.id)
          .update({ guest: update })
        commit('setUserId', payload.formData.id)
      },
      async distributionThema({ _commit, state }) {
        const querySnapshot = await db.collection('themas').get()
        const themasSize = querySnapshot.size // 全テーマの数
        const randomThema = Math.floor(Math.random() * themasSize) // どのテーマを選ぶかの乱数
        const items = [] // dataの配列

        querySnapshot.forEach((Doc) => {
          items.push(Doc.data())
        })

        const thisThema = items[randomThema] // 選んだテーマ
        const wolfThemaNum = Math.floor(Math.random() * 2)
        let citizenThemaNum = 1
        if (wolfThemaNum === 1) {
          citizenThemaNum = citizenThemaNum - 1
        }
        const wolfThema = thisThema.data[wolfThemaNum] // wolfのテーマ
        const citizenThema = thisThema.data[citizenThemaNum] // 市民のテーマ

        const guest = state.room.guest // ゲストのリスト
        const owner = state.room.owner

        const guestLength = guest.length // ゲストの人数
        const wolfNumber = Math.floor(Math.random() * (guestLength + 1)) // wolfの人の番号
        if (wolfNumber === guestLength) {
          // オーナーがwolfの時
          const update = guest.map((user) => {
            return {
              ...user,
              thema: citizenThema,
              isWolf: false
            }
          })
          const ownerUpdate = {
            thema: wolfThema,
            name: owner.name,
            isWolf: true
          }
          console.log(ownerUpdate)
          db.collection('rooms')
            .doc(state.room.id)
            .update({ guest: update, owner: ownerUpdate })
        } else {
          // guestの中にwolfがいる時
          const update = guest.map((user, index) => {
            if (index === wolfNumber) {
              return {
                ...user,
                thema: wolfThema,
                isWolf: true
              }
            } else {
              return {
                ...user,
                thema: citizenThema,
                isWolf: false
              }
            }
          })
          const ownerUpdate = {
            thema: citizenThema,
            name: owner.name,
            isWolf: false
          }
          db.collection('rooms')
            .doc(state.room.id)
            .update({ guest: update, owner: ownerUpdate })
        }
      },
      // todo: トランザクション
      readyAction({ _commit, state }) {
        const guest = state.room.guest
        const update = guest.map((user) => {
          if (user.id !== state.userId) {
            return user
          } else {
            return {
              ...user,
              isReady: true
            }
          }
        })
        db.collection('rooms')
          .doc(state.room.id)
          .update({ guest: update })
      },
      ownerReadyAction({ _commit, state }) {
        const ownerUpdata = {
          ...state.room.owner,
          isReady: true
        }
        db.collection('rooms')
          .doc(state.room.id)
          .update({ owner: ownerUpdata })
      }
    },

    getters: {
      getRooms: (state) => {
        return state.rooms
      },
      getRoom: (state) => {
        return state.room
      },
      // state.roomのowner, guestを配列化して取り出すgetter関数
      getUsers: (state) => {
        const users = [state.room.owner]
        return users.concat(state.room.guest)
      },
      isStart: (state) => {
        return state.room.isStart
      },
      // userIdから自分の状態を取得
      getUser: (state) => {
        if (state.isOwner) {
          return state.room.owner
        }
        const user = state.room.guest.find((user) => user.id === state.userId)
        if (user === undefined) {
          return { isReady: false }
        } else {
          return user
        }
      }
    }
  })
}

export default createStore
