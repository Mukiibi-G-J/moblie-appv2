import React from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Image,
    TextInput,
    FlatList
} from 'react-native';
import { useNavigation } from '@react-navigation/native';


// import { FilterModal } from "../";
// import {
//     HorizontalFoodCard,
//     VerticalFoodCard
// } from "../../components";
import { FONTS, SIZES, COLORS, icons, dummyData } from "../../constants";
import Options from './Options';

const Section = ({ title, onPress, children }) => {
    return (
        <View>
            {/* Header */}
            <View
                style={{
                    flexDirection: 'row',
                    marginHorizontal: SIZES.padding,
                    marginTop: 30,
                    marginBottom: 20
                }}
            >
                <Text style={{ flex: 1, ...FONTS.h3 }}>
                    {title}
                </Text>

                <TouchableOpacity
                    onPress={onPress}
                >
                    <Text style={{ color: COLORS.primary, ...FONTS.body3 }}>
                        Show All
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Content */}
            {children}
        </View>
    )
}




export default function Home({ selectedTab }) {
    const [selectedCategoryId, setSelectedCategoryId] = React.useState(1)
    const [selectedMenuType, setSelectedMenuType] = React.useState(1)
    const [popular, setPopular] = React.useState([])
    const [recommends, setRecommends] = React.useState([])
    const [menuList, setMenuList] = React.useState([])

    const [showFilterModal, setShowFilterModal] = React.useState(false)

    const navigation = useNavigation();

    React.useEffect(() => {
        handleChangeCategory(selectedCategoryId, selectedMenuType)
    }, [])

    React.useEffect(() => {
        if (selectedTab == "Home") {

        }
    }, [selectedTab])

    // Handler

    function handleChangeCategory(categoryId, menuTypeId) {
        // Retrieve the popular menu
        let selectedPopular = dummyData.menu.find(a => a.name == "Popular")

        // Retrieve the recommended menu
        let selectedRecommend = dummyData.menu.find(a => a.name == "Recommended")

        // Find the menu based on the menuTypeId
        let selectedMenu = dummyData.menu.find(a => a.id == menuTypeId)

        // Set the popular menu based on the categoryId
        setPopular(selectedPopular?.list.filter(a => a.categories.includes(categoryId)))

        // Set the recommended menu based on the categoryId
        setRecommends(selectedRecommend?.list.filter(a => a.categories.includes(categoryId)))

        // Set the menu based on the categoryId
        setMenuList(selectedMenu?.list.filter(a => a.categories.includes(categoryId)))
    }

    // Render

    function renderSearch() {
        return (
            <View
                style={{
                    flexDirection: 'row',
                    height: 40,
                    alignItems: 'center',
                    marginHorizontal: SIZES.padding,
                    marginVertical: SIZES.base,
                    paddingHorizontal: SIZES.radius,
                    borderRadius: SIZES.radius,
                    backgroundColor: COLORS.lightGray2
                }}
            >
                {/* Icon */}
                <Image
                    source={icons.search}
                    style={{
                        height: 20,
                        width: 20,
                        tintColor: COLORS.black
                    }}
                />

                {/* Text Input */}
                <TextInput
                    style={{
                        flex: 1,
                        marginLeft: SIZES.radius,
                        ...FONTS.body3
                    }}
                    placeholder="search food..."
                />

                {/* Filter Button */}
                <TouchableOpacity
                    onPress={() => setShowFilterModal(true)}
                >
                    <Image
                        source={icons.filter}
                        style={{
                            height: 20,
                            width: 20,
                            tintColor: COLORS.black
                        }}
                    />
                </TouchableOpacity>
            </View>
        )
    }

    function renderMenuTypes() {
        return (
            <FlatList
                horizontal
                data={dummyData.menu}
                keyExtractor={item => `${item.id}`}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{
                    marginTop: 30,
                    marginBottom: 20
                }}
                renderItem={({ item, index }) => (
                    <TouchableOpacity
                        style={{
                            marginLeft: SIZES.padding,
                            marginRight: index == dummyData.menu.length - 1 ? SIZES.padding : 0
                        }}
                        onPress={() => {
                            setSelectedMenuType(item.id)
                            handleChangeCategory(selectedCategoryId, item.id)
                        }}
                    >
                        <Text
                            style={{
                                color: selectedMenuType == item.id ? COLORS.primary : COLORS.black,
                                ...FONTS.h3
                            }}
                        >
                            {item.name}
                        </Text>
                    </TouchableOpacity>
                )}
            />
        )
    }
    return (
        <View
            style={{
                flex: 1
            }}
        >
            {/* Search */}
            {/* {renderSearch()} */}
            <Options />

        </View>
    )
}