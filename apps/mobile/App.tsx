import { ChecklistsScreen } from "./src/screens/checklists";
import { DecisionsScreen } from "./src/screens/decisions";
import { ReportsScreen } from "./src/screens/reports";
import { ClipsScreen } from "./src/screens/clips";
import { AssistantScreen } from "./src/screens/assistant";
import { DocumentsScreen } from "./src/screens/documents";
import { InboxScreen } from "./src/screens/inbox";
import { StockScreen } from "./src/screens/stock";
import { EnquiriesScreen, EnquiryScreen } from "./src/screens/enquiries";
import { ServiceFinanceScreen } from "./src/screens/service-finance";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { NavigationContainer, DarkTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import Ionicons from "@expo/vector-icons/Ionicons";
import { colors } from "@arihant/design-tokens";
import { AppProvider, useApp } from "./src/state/app-context";
import type { RootStack } from "./src/navigation";
import { LoginScreen } from "./src/screens/login";
import { HomeScreen } from "./src/screens/home";
import { CarsScreen } from "./src/screens/cars";
import { CarScreen } from "./src/screens/car";
import { TaskScreen } from "./src/screens/task";
import { ScanScreen } from "./src/screens/scan";
import { SettingsScreen } from "./src/screens/settings";
import { AddCarScreen } from "./src/screens/add-car";
import { AssignInspectionScreen } from "./src/screens/assign-inspection";
import { JobsScreen } from "./src/screens/jobs";
import { JobScreen } from "./src/screens/job";
import { AssignRepairScreen } from "./src/screens/assign-repair";
import { WorkshopsScreen } from "./src/screens/workshops";
import { PurchasesScreen } from "./src/screens/purchases";
import { PurchaseScreen } from "./src/screens/purchase";
import { BusinessScreen } from "./src/screens/business";
import { BusinessBoardScreen } from "./src/screens/business-board";
import { ChangePasswordScreen } from "./src/screens/change-password";
import { TeamScreen } from "./src/screens/team";
import { loadLocal, saveLocal } from "./src/adapters/local-store";
const Stack = createNativeStackNavigator<RootStack>();
function AuthenticatedRoutes({ ownerId }: { ownerId: string }) {
  const [ready, setReady] = useState(false);
  const [initialState, setInitialState] =
    useState<
      React.ComponentProps<typeof NavigationContainer>["initialState"]
    >();
  useEffect(() => {
    let active = true;
    void loadLocal<
      React.ComponentProps<typeof NavigationContainer>["initialState"]
    >(ownerId, "navigation:v1")
      .then((state) => {
        if (active) {
          setInitialState(state || undefined);
          setReady(true);
        }
      })
      .catch(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, [ownerId]);
  if (!ready) return <ActivityIndicator color="#fff" style={{ flex: 1 }} />;
  return (
    <NavigationContainer
      {...(initialState ? { initialState } : {})}
      onStateChange={(state) => {
        void saveLocal(ownerId, "navigation:v1", state).catch(() => {});
      }}
      theme={{
        ...DarkTheme,
        colors: {
          ...DarkTheme.colors,
          background: colors.surface,
          card: colors.black,
          primary: colors.red,
        },
      }}
    >
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.surface },
        }}
      >
        <Stack.Screen name="Assistant" component={AssistantScreen} />
        <Stack.Screen name="Clips" component={ClipsScreen} />
        <Stack.Screen name="Decisions" component={DecisionsScreen} />
        <Stack.Screen name="Reports" component={ReportsScreen} />
        <Stack.Screen name="Checklists" component={ChecklistsScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Cars" component={CarsScreen} />
        <Stack.Screen name="Car" component={CarScreen} />
        <Stack.Screen name="Task" component={TaskScreen} />
        <Stack.Screen name="Scan" component={ScanScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="AddCar" component={AddCarScreen} />
        <Stack.Screen
          name="AssignInspection"
          component={AssignInspectionScreen}
        />
        <Stack.Screen name="Jobs" component={JobsScreen} />
        <Stack.Screen name="Job" component={JobScreen} />
        <Stack.Screen name="AssignRepair" component={AssignRepairScreen} />
        <Stack.Screen name="Workshops" component={WorkshopsScreen} />
        <Stack.Screen name="Purchases" component={PurchasesScreen} />
        <Stack.Screen name="Purchase" component={PurchaseScreen} />
        <Stack.Screen name="Business" component={BusinessScreen} />
        <Stack.Screen name="BusinessBoard" component={BusinessBoardScreen} />
        <Stack.Screen name="ServiceFinance" component={ServiceFinanceScreen} />
        <Stack.Screen name="Enquiries" component={EnquiriesScreen} />
        <Stack.Screen name="Enquiry" component={EnquiryScreen} />
        <Stack.Screen name="Stock" component={StockScreen} />
        <Stack.Screen name="Inbox" component={InboxScreen} />
        <Stack.Screen name="Documents" component={DocumentsScreen} />
        <Stack.Screen name="Team" component={TeamScreen} />
        <Stack.Screen name="Security">
          {({ navigation }) => (
            <ChangePasswordScreen
              onComplete={() => navigation.goBack()}
              onCancel={() => navigation.goBack()}
            />
          )}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}
function Routes() {
  const { booting, session } = useApp();
  if (booting)
    return (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  if (!session) return <LoginScreen />;
  if (session.mustChangeSecret) return <ChangePasswordScreen />;
  return (
    <AuthenticatedRoutes key={session.actor.id} ownerId={session.actor.id} />
  );
}
export default function App() {
  const [fonts, error] = useFonts({
    Jakarta: require("./assets/plus-jakarta-sans.ttf"),
    ...Ionicons.font,
  });
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.black }}>
        <AppProvider>
          {fonts || error ? (
            <Routes />
          ) : (
            <View style={{ flex: 1, justifyContent: "center" }}>
              <ActivityIndicator color="#fff" />
            </View>
          )}
        </AppProvider>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
